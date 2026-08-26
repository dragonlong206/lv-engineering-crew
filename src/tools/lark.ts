import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { printInfo, printWarn } from '../cli/helpers.js';
import type { Config } from '../types.js';

export interface LarkTicket {
  id: string;
  title: string;
  description: string;
  featureIds: string[];
  rawFields: Record<string, unknown>;
}

/**
 * Exchanges app_id/app_secret for a tenant_access_token, per
 * https://open.larksuite.com/document/server-docs/getting-started/api-access-token/auth-v3/tenant_access_token_internal
 * Tokens are valid up to 2h — fetched fresh per CLI invocation rather than cached across runs.
 */
export async function getTenantAccessToken(appId: string, appSecret: string): Promise<string> {
  const response = await fetch('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });

  const data = (await response.json()) as {
    code: number;
    msg: string;
    tenant_access_token?: string;
  };

  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Lark auth error ${data.code}: ${data.msg}`);
  }

  return data.tenant_access_token;
}

export async function fetchTicket(
  ticketId: string,
  baseId: string,
  tableId: string,
  featureIdField: string,
  titleField: string,
  token: string,
): Promise<LarkTicket> {
  const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${baseId}/tables/${tableId}/records/${ticketId}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Lark API error ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    data?: { record?: { fields?: Record<string, unknown> } };
    msg?: string;
  };

  if (!data.data?.record?.fields) {
    throw new Error(`Ticket ${ticketId} not found. Lark response: ${data.msg ?? 'unknown error'}`);
  }

  const fields = data.data.record.fields;

  const rawFeatureId = fields[featureIdField];
  let featureIds: string[] = [];

  if (typeof rawFeatureId === 'string' && rawFeatureId.trim()) {
    featureIds = rawFeatureId.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (Array.isArray(rawFeatureId)) {
    featureIds = rawFeatureId.flatMap((v) =>
      typeof v === 'string' ? v.split(',').map((s) => s.trim()) : [],
    ).filter(Boolean);
  }

  const rawTitle = fields[titleField];
  const title = typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle : ticketId;

  const description = typeof fields['Description'] === 'string' ? fields['Description'] :
    typeof fields['description'] === 'string' ? fields['description'] : '';

  return { id: ticketId, title, description, featureIds, rawFields: fields };
}

/**
 * Writes one or more newly allocated feature IDs back onto a ticket's Feature ID field,
 * preserving whether the field holds a comma-joined string or an array (same shape
 * `fetchTicket` reads) and appending rather than overwriting any feature IDs already present.
 * All new IDs are folded into a single write — the Lark PUT replaces the field's value
 * wholesale, so appending them one call at a time would drop everything but the last.
 *
 * Throws on failure — callers that want this to be non-fatal (e.g. `lv start`) should catch it.
 */
export async function updateTicketFeatureId(
  ticket: LarkTicket,
  newFeatureIds: string[],
  baseId: string,
  tableId: string,
  featureIdField: string,
  token: string,
): Promise<void> {
  const existing = ticket.rawFields[featureIdField];
  const fields: Record<string, unknown> = {};

  if (Array.isArray(existing)) {
    fields[featureIdField] = [...existing, ...newFeatureIds];
  } else {
    const existingStr = typeof existing === 'string' ? existing.trim() : '';
    fields[featureIdField] = [existingStr, ...newFeatureIds].filter(Boolean).join(', ');
  }

  const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${baseId}/tables/${tableId}/records/${ticket.id}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ fields }),
  });

  const data = (await response.json()) as { code: number; msg?: string };

  if (!response.ok || data.code !== 0) {
    throw new Error(`Lark update error ${data.code ?? response.status}: ${data.msg ?? 'unknown error'}`);
  }
}

/**
 * Creates a record for a newly created feature in a dedicated Lark Base Features table.
 * When `ticket` is given (a ticket-triggered creation), the record also references the
 * originating ticket; otherwise the record carries only the feature ID and title.
 *
 * Throws on failure — `syncFeatureToLarkTable()` below is the non-fatal wrapper callers use.
 */
export async function createFeatureRecord(
  featureId: string,
  title: string,
  baseId: string,
  tableId: string,
  token: string,
  ticket?: Pick<LarkTicket, 'id' | 'title'>,
): Promise<void> {
  const fields: Record<string, unknown> = {
    'Feature ID': featureId,
    Title: title,
  };
  if (ticket) {
    fields['Ticket ID'] = ticket.id;
    fields['Ticket Title'] = ticket.title;
  }

  const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${baseId}/tables/${tableId}/records`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ fields }),
  });

  const data = (await response.json()) as { code: number; msg?: string };

  if (!response.ok || data.code !== 0) {
    throw new Error(`Lark create error ${data.code ?? response.status}: ${data.msg ?? 'unknown error'}`);
  }
}

/**
 * Non-fatal wrapper around `createFeatureRecord()` for the three call sites that generate a
 * brand-new feature's docs (`lv bootstrap` in both its modes, and `lv start`'s inline
 * bootstrap). No-ops when `lark.features_table_id` is unset or `lark.sync_new_features` is
 * disabled; a create failure is reported but never thrown, so it can't fail the invoking
 * command — same non-fatal intent as the `sync_feature_id` write-back, just centralized here
 * instead of repeated at each call site.
 */
export async function syncFeatureToLarkTable(
  config: Config,
  larkToken: string,
  featureId: string,
  title: string,
  ticket?: Pick<LarkTicket, 'id' | 'title'>,
): Promise<void> {
  if (!config.lark.features_table_id) return;
  if (!config.lark.sync_new_features) return;

  try {
    await createFeatureRecord(
      featureId,
      title,
      config.lark.base_id,
      config.lark.features_table_id,
      larkToken,
      ticket,
    );
    printInfo(`Synced feature ${featureId} to Lark Features table.`);
  } catch (err) {
    printWarn(
      `Failed to sync feature ${featureId} to Lark Features table: ${(err as Error).message}. Continuing.`,
    );
  }
}

export const larkTicketTool = createTool({
  id: 'fetchLarkTicket',
  description: 'Fetch a ticket record from Lark Base',
  inputSchema: z.object({
    ticketId: z.string(),
    baseId: z.string(),
    tableId: z.string(),
    featureIdField: z.string(),
    titleField: z.string(),
    token: z.string(),
  }),
  execute: async ({ ticketId, baseId, tableId, featureIdField, titleField, token }) => {
    const ticket = await fetchTicket(ticketId, baseId, tableId, featureIdField, titleField, token);
    return ticket;
  },
});
