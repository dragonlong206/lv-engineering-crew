import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { printInfo, printWarn } from '../cli/helpers.js';
import type { Config } from '../types.js';

export interface LarkTicket {
  id: string;
  title: string;
  description: string;
  featureIds: string[];
  projectRecordIds: string[];
  rawFields: Record<string, unknown>;
}

/**
 * Extracts linked record IDs from a Bitable link-field's read value (single-link or
 * duplex-link), which comes back as an array of `{ record_ids, table_id, text, text_arr }`
 * objects — `record_ids` is omitted entirely when the link is empty. Returns `[]` for any
 * other shape (unset field, or a field that isn't a link type).
 */
function extractLinkRecordIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const entry of value) {
    if (entry && typeof entry === 'object' && Array.isArray((entry as { record_ids?: unknown }).record_ids)) {
      ids.push(...(entry as { record_ids: string[] }).record_ids);
    }
  }
  return ids;
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
  projectField: string,
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

  const projectRecordIds = extractLinkRecordIds(fields[projectField]);

  return { id: ticketId, title, description, featureIds, projectRecordIds, rawFields: fields };
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
 * Writes the ticket's status field to `newStatus`. Unlike `updateTicketFeatureId()`, this is a
 * plain string replace — the status field is a single-select, not a list/comma-joined field —
 * so there's no existing-value shape to preserve or append to.
 *
 * Throws on failure — callers that want this to be non-fatal (e.g. `lv start`) should catch it.
 */
export async function updateTicketStatus(
  ticket: LarkTicket,
  newStatus: string,
  baseId: string,
  tableId: string,
  statusField: string,
  token: string,
): Promise<void> {
  const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${baseId}/tables/${tableId}/records/${ticket.id}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ fields: { [statusField]: newStatus } }),
  });

  const data = (await response.json()) as { code: number; msg?: string };

  if (!response.ok || data.code !== 0) {
    throw new Error(`Lark update error ${data.code ?? response.status}: ${data.msg ?? 'unknown error'}`);
  }
}

/**
 * Creates a record for a newly created feature in a dedicated Lark Base Features table. The
 * Features table is separate from the ticket/task table and carries no reference back to a
 * ticket — the record holds the feature ID, title, and (when `projectRecordIds` is given and
 * non-empty) the same Projects-table link the originating ticket carries, since the Features
 * table has its own independent link field to that same Projects table. Column names come
 * from `LarkConfigSchema`'s `features_table_*_field` settings, so they can be pointed at
 * whatever an existing Features table actually calls those columns.
 *
 * Throws on failure — `syncFeatureToLarkTable()` below is the non-fatal wrapper callers use.
 */
export async function createFeatureRecord(
  featureId: string,
  title: string,
  baseId: string,
  tableId: string,
  token: string,
  fieldNames: Pick<
    Config['lark'],
    'features_table_feature_id_field' | 'features_table_title_field' | 'features_table_project_field'
  >,
  projectRecordIds?: string[],
): Promise<void> {
  const fields: Record<string, unknown> = {
    [fieldNames.features_table_feature_id_field]: featureId,
    [fieldNames.features_table_title_field]: title,
  };
  if (projectRecordIds && projectRecordIds.length > 0) {
    fields[fieldNames.features_table_project_field] = projectRecordIds;
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
 * Looks up whether `featureId` already has a record in the Lark Features table. Used by
 * `syncFeatureToLarkTable()` to decide whether to create one — checking Lark directly, rather
 * than trusting local `docs/features/<id>/` presence as a proxy, is what lets that function
 * backfill a record for a feature whose docs already existed locally but whose Lark write
 * never happened (e.g. generated before `features_table_id` was configured, or a prior sync
 * attempt failed).
 */
async function featureRecordExists(
  featureId: string,
  baseId: string,
  tableId: string,
  featureIdField: string,
  token: string,
): Promise<boolean> {
  const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${baseId}/tables/${tableId}/records/search`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      filter: {
        conjunction: 'and',
        conditions: [{ field_name: featureIdField, operator: 'is', value: [featureId] }],
      },
      page_size: 1,
    }),
  });

  const data = (await response.json()) as { code: number; msg?: string; data?: { total?: number } };

  if (!response.ok || data.code !== 0) {
    throw new Error(`Lark search error ${data.code ?? response.status}: ${data.msg ?? 'unknown error'}`);
  }

  return (data.data?.total ?? 0) > 0;
}

/**
 * Non-fatal, idempotent sync of one feature into the Lark Features table. No-ops when
 * `lark.features_table_id` is unset or `lark.sync_new_features` is disabled. Otherwise checks
 * Lark first via `featureRecordExists()` and only creates a record when one isn't already
 * there — so callers can call this for every feature a command touches, not just ones whose
 * local docs directory was just created, and a feature with existing docs but a missing Lark
 * record still gets backfilled. A create (or lookup) failure is reported but never thrown, so
 * it can't fail the invoking command — same non-fatal intent as the `sync_feature_id`
 * write-back.
 */
export async function syncFeatureToLarkTable(
  config: Config,
  larkToken: string,
  featureId: string,
  title: string,
  projectRecordIds?: string[],
): Promise<void> {
  if (!config.lark.features_table_id) return;
  if (!config.lark.sync_new_features) return;

  try {
    const alreadySynced = await featureRecordExists(
      featureId,
      config.lark.base_id,
      config.lark.features_table_id,
      config.lark.features_table_feature_id_field,
      larkToken,
    );
    if (alreadySynced) return;

    await createFeatureRecord(
      featureId,
      title,
      config.lark.base_id,
      config.lark.features_table_id,
      larkToken,
      config.lark,
      projectRecordIds,
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
    projectField: z.string(),
    token: z.string(),
  }),
  execute: async ({ ticketId, baseId, tableId, featureIdField, titleField, projectField, token }) => {
    const ticket = await fetchTicket(ticketId, baseId, tableId, featureIdField, titleField, projectField, token);
    return ticket;
  },
});
