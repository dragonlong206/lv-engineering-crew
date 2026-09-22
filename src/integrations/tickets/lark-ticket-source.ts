import type { Config } from '../../types.js';
import type { Ticket, TicketSource } from './types.js';
import {
  getTenantAccessToken,
  fetchTicket,
  downloadTicketAttachments,
  updateTicketFeatureId,
  updateTicketStatus,
  createSubticket,
  type LarkTicket,
} from '../../tools/lark.js';
import { printInfo, printSuccess, printWarn, printError } from '../../cli/helpers.js';

/** What this source stashes on `Ticket.raw` — read back only by this same source's own methods. */
interface LarkRaw {
  ticket: LarkTicket;
}

/**
 * `TicketSource` plus one Lark-only extra: the cached tenant-access-token this source's other
 * methods already fetch and reuse. `syncFeatureToLarkTable()` (feature docs → Lark Features
 * table sync — kept as a direct `src/tools/lark.ts` call from `startFromTicket`, per design.md's
 * Non-Goals) needs that same token; exposing it here — on the concrete Lark handle, not the
 * generic `TicketSource` interface — lets that one already-Lark-specific call site reuse this
 * invocation's single token fetch instead of triggering a second one. A future non-Lark source
 * has no equivalent method and none is required by `TicketSource` itself.
 */
export interface LarkTicketSourceHandle extends TicketSource {
  getAccessToken(): Promise<string>;
}

function toTicket(larkTicket: LarkTicket): Ticket {
  return {
    id: larkTicket.id,
    title: larkTicket.title,
    description: larkTicket.description,
    featureIds: larkTicket.featureIds,
    uiDesignRefs: larkTicket.uiDesignRefs,
    attachments: larkTicket.attachments,
    projectRefs: larkTicket.projectRecordIds,
    raw: { ticket: larkTicket } satisfies LarkRaw,
  };
}

function fromRaw(ticket: Ticket): LarkTicket {
  return (ticket.raw as LarkRaw).ticket;
}

/**
 * `TicketSource` backed by Lark Base. Owns everything Lark-specific that used to live inline in
 * `startFromTicket()`: the credential check, tenant-token fetch (cached for the lifetime of the
 * source instance — one per `lv start` invocation, matching today's "fetched fresh per CLI
 * invocation" behavior), and every write-back's enabled/disabled branching and console
 * messaging. See design.md's Decision 1/2 for why this shape.
 */
export function createLarkTicketSource(config: Config): LarkTicketSourceHandle {
  let cachedToken: string | undefined;

  async function getToken(): Promise<string> {
    if (cachedToken) return cachedToken;
    if (!config.lark_app_id || !config.lark_app_secret) {
      printError(
        "Missing Lark app credentials. Set 'lark_app_id' and 'lark_app_secret' in .lv.local.yaml (or LARK_APP_ID/LARK_APP_SECRET env vars).",
      );
      process.exit(1);
    }
    cachedToken = await getTenantAccessToken(config.lark_app_id, config.lark_app_secret);
    return cachedToken;
  }

  return {
    getAccessToken: () => getToken(),

    async fetch(ticketId) {
      const token = await getToken();
      printInfo(`Fetching ticket ${ticketId} from Lark Base...`);
      const larkTicket = await fetchTicket(
        ticketId,
        config.lark.base_id,
        config.lark.table_id,
        config.lark.feature_id_field,
        config.lark.title_field,
        config.lark.project_field,
        token,
        config.lark.ui_design_field,
        config.lark.attachment_field,
      );
      return toTicket(larkTicket);
    },

    async downloadAttachments(ticket, destDir) {
      const token = await getToken();
      return downloadTicketAttachments(ticket.attachments, destDir, token);
    },

    async updateFeatureId(ticket, featureIds, featureRecordIds) {
      if (!config.lark.sync_feature_id) {
        printInfo(
          `Lark sync disabled (lark.sync_feature_id: false) — ${featureIds.join(', ')} ${featureIds.length > 1 ? 'are' : 'is'} local-only.`,
        );
        return;
      }

      const token = await getToken();
      try {
        await updateTicketFeatureId(
          fromRaw(ticket),
          featureIds,
          config.lark.base_id,
          config.lark.table_id,
          config.lark.feature_id_field,
          token,
          featureRecordIds,
        );
        printSuccess(
          `Synced feature${featureIds.length > 1 ? 's' : ''} ${featureIds.join(', ')} back to Lark ticket ${ticket.id}.`,
        );
      } catch (err) {
        printWarn(
          `Failed to sync feature${featureIds.length > 1 ? 's' : ''} ${featureIds.join(', ')} back to Lark: ${(err as Error).message}. ` +
            `Continuing — the feature${featureIds.length > 1 ? 's remain' : ' remains'} local-only.`,
        );
      }
    },

    async updateStatus(ticket) {
      if (!config.lark.sync_status) {
        printInfo(
          `Lark status sync disabled (lark.sync_status: false) — ticket ${ticket.id}'s status is unchanged.`,
        );
        return;
      }

      const larkTicket = fromRaw(ticket);
      const currentStatus = larkTicket.rawFields[config.lark.status_field];
      if (currentStatus === config.lark.in_dev_status_value) return;

      const token = await getToken();
      try {
        await updateTicketStatus(
          larkTicket,
          config.lark.in_dev_status_value,
          config.lark.base_id,
          config.lark.table_id,
          config.lark.status_field,
          token,
        );
        printSuccess(
          `Updated ticket ${ticket.id} status to "${config.lark.in_dev_status_value}".`,
        );
      } catch (err) {
        printWarn(
          `Failed to update ticket ${ticket.id} status to "${config.lark.in_dev_status_value}": ${(err as Error).message}. Continuing.`,
        );
      }
    },

    async createSubtickets(parent, subtasks) {
      if (!config.lark.subtask_parent_field) {
        printWarn(
          `lark.subtask_parent_field is unset — sub-tickets will be created without a recorded link back to ${parent.id}.`,
        );
      }

      const token = await getToken();
      const created: { id: string; title: string }[] = [];
      const failed: { title: string; error: string }[] = [];

      for (const subtask of subtasks) {
        try {
          const id = await createSubticket(
            subtask.title,
            subtask.description,
            parent.id,
            config.lark.base_id,
            config.lark.table_id,
            config.lark.title_field,
            token,
            config.lark.subtask_parent_field,
          );
          created.push({ id, title: subtask.title });
        } catch (err) {
          failed.push({ title: subtask.title, error: (err as Error).message });
        }
      }

      return { created, failed };
    },
  };
}
