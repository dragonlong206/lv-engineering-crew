import fs from 'fs';
import path from 'path';
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
  // UI design reference(s) (Figma link, HTML prototype, image, or PDF), normalized via
  // `normalizeUiDesignRefs()`. Empty when `ui_design_field` isn't configured or resolves to
  // nothing — never undefined, so callers can check `.length` without an extra guard.
  uiDesignRefs: string[];
  // Attachment metadata (file_token + original filename) extracted from `attachment_field`,
  // via `extractAttachments()`. Empty when `attachment_field` isn't configured or resolves to
  // nothing. Downloading the actual file content is a separate step
  // (`downloadTicketAttachments()`), not performed here.
  attachments: { fileToken: string; name: string }[];
  rawFields: Record<string, unknown>;
  // Whether `featureIdField` (the field named by `lark.feature_id_field`) is a Bitable Link
  // field, per `isLinkField()`. Determined once in `fetchTicket()` and carried on the ticket
  // so `updateTicketFeatureId()` doesn't need to re-look it up.
  featureIdFieldIsLink: boolean;
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
 * Extracts the human-readable labels (the linked record's primary field text) from a Bitable
 * link-field's read value, via each entry's `text_arr`. Used for `feature_id_field` when
 * `isLinkField()` detects it as a Link field, since the Features table's primary field is
 * expected to hold the feature ID itself (e.g. "F0001") — same read shape `extractLinkRecordIds`
 * handles, different property.
 */
function extractLinkTexts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const texts: string[] = [];
  for (const entry of value) {
    if (entry && typeof entry === 'object' && Array.isArray((entry as { text_arr?: unknown }).text_arr)) {
      texts.push(...(entry as { text_arr: string[] }).text_arr);
    }
  }
  return texts;
}

/**
 * Normalizes a UI design column's raw read value — which may be a plain text/URL field, a
 * `{text, link}`-shaped URL-type field, or a Lark attachment field (array of file objects) —
 * into a flat list of reference strings. Unlike `feature_id_field`, this never needs to tell
 * "empty link field" apart from "empty text field": both simply produce zero references, so a
 * single shape-sniffing pass suffices without an `isLinkField()`-style metadata lookup. Drops
 * (rather than throws on) any entry that resolves to nothing usable.
 */
function normalizeUiDesignRefs(value: unknown): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const { text, link } = value as { text?: unknown; link?: unknown };
    const ref = (typeof link === 'string' && link.trim()) || (typeof text === 'string' && text.trim());
    return ref ? [ref] : [];
  }

  if (Array.isArray(value)) {
    const refs: string[] = [];
    for (const entry of value) {
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (trimmed) refs.push(trimmed);
        continue;
      }
      if (entry && typeof entry === 'object') {
        const { url, tmp_url, name } = entry as { url?: unknown; tmp_url?: unknown; name?: unknown };
        const ref =
          (typeof url === 'string' && url.trim()) ||
          (typeof tmp_url === 'string' && tmp_url.trim()) ||
          (typeof name === 'string' && name.trim());
        if (ref) refs.push(ref);
      }
    }
    return refs;
  }

  return [];
}

/**
 * Extracts downloadable attachment metadata from a Lark attachment-field's raw read value — an
 * array of file objects each carrying `file_token`/`name` (plus fields this doesn't need, like
 * `size`/`type`/`url`/`tmp_url`). Unlike `normalizeUiDesignRefs()`, which only needs a
 * reference string, attachment *download* requires `file_token` — the id Lark's Drive
 * media-download endpoint takes — so entries missing it are dropped rather than falling back to
 * `url`/`tmp_url`/`name`.
 */
function extractAttachments(value: unknown): { fileToken: string; name: string }[] {
  if (!Array.isArray(value)) return [];

  const attachments: { fileToken: string; name: string }[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const { file_token, name } = entry as { file_token?: unknown; name?: unknown };
    if (typeof file_token === 'string' && file_token.trim()) {
      attachments.push({
        fileToken: file_token.trim(),
        name: typeof name === 'string' && name.trim() ? name.trim() : file_token.trim(),
      });
    }
  }
  return attachments;
}

// Lark Bitable numeric field `type`s for a single-link and a duplex-link field, per
// https://open.larksuite.com/document/server-docs/docs/bitable-v1/app-table-field/field-list
const LINK_FIELD_TYPES = new Set([18, 21]);

/**
 * Looks up whether `fieldName` in the given table is a Bitable Link field (single-link or
 * duplex-link), by paging through the table's field metadata until a name match is found.
 * Determining this from the field's own definition — rather than a config flag, or sniffing the
 * shape of a record's value for that field — is what lets `fetchTicket`/`updateTicketFeatureId`
 * handle a ticket whose `feature_id_field` currently has no value at all: an empty Link field's
 * read value is indistinguishable from an empty text field's, so shape alone can't tell them
 * apart, but the field's declared type always can. Returns `false` (not `undefined`) when the
 * field name isn't found, so callers can treat "field missing" the same as "not a link" rather
 * than special-casing it.
 */
async function isLinkField(baseId: string, tableId: string, fieldName: string, token: string): Promise<boolean> {
  let pageToken: string | undefined;

  do {
    const url = new URL(`https://open.larksuite.com/open-apis/bitable/v1/apps/${baseId}/tables/${tableId}/fields`);
    url.searchParams.set('page_size', '100');
    if (pageToken) url.searchParams.set('page_token', pageToken);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = (await response.json()) as {
      code: number;
      msg?: string;
      data?: { items?: { field_name: string; type: number }[]; has_more?: boolean; page_token?: string };
    };

    if (!response.ok || data.code !== 0) {
      throw new Error(`Lark field-list error ${data.code ?? response.status}: ${data.msg ?? 'unknown error'}`);
    }

    const match = data.data?.items?.find((f) => f.field_name === fieldName);
    if (match) return LINK_FIELD_TYPES.has(match.type);

    pageToken = data.data?.has_more ? data.data.page_token : undefined;
  } while (pageToken);

  return false;
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
  uiDesignField?: string,
  attachmentField?: string,
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

  const featureIdFieldIsLink = await isLinkField(baseId, tableId, featureIdField, token);

  const rawFeatureId = fields[featureIdField];
  let featureIds: string[] = [];

  if (featureIdFieldIsLink) {
    featureIds = extractLinkTexts(rawFeatureId).map((s) => s.trim()).filter(Boolean);
  } else if (typeof rawFeatureId === 'string' && rawFeatureId.trim()) {
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

  const uiDesignRefs = uiDesignField ? normalizeUiDesignRefs(fields[uiDesignField]) : [];

  const attachments = attachmentField ? extractAttachments(fields[attachmentField]) : [];

  return {
    id: ticketId,
    title,
    description,
    featureIds,
    projectRecordIds,
    uiDesignRefs,
    attachments,
    rawFields: fields,
    featureIdFieldIsLink,
  };
}

/**
 * Downloads a ticket's extracted attachments (from `LarkTicket.attachments`) into `destDir`,
 * via Lark's Drive media-download endpoint (`GET /open-apis/drive/v1/medias/:file_token/download`)
 * — the attachment field's own `url`/`tmp_url` are browser-facing preview links, not a
 * guaranteed stable authenticated download; `file_token` is the documented way to retrieve the
 * actual file bytes. Each file's original `name` is sanitized (path separators and other
 * filesystem-unsafe characters stripped) and de-duplicated against filenames already written in
 * this same call (`file.png`, `file-2.png`, ...), so two same-named attachments on one ticket
 * don't overwrite each other.
 *
 * A single attachment's failure (stale `file_token`, network error, etc.) is caught and
 * collected into `failed` rather than thrown, so one bad file doesn't cost every other
 * attachment that does download successfully — same non-fatal posture callers already expect
 * from `syncFeatureToLarkTable()`/`updateTicketStatus()`.
 */
export async function downloadTicketAttachments(
  attachments: { fileToken: string; name: string }[],
  destDir: string,
  token: string,
): Promise<{ downloaded: string[]; failed: { name: string; error: string }[] }> {
  const downloaded: string[] = [];
  const failed: { name: string; error: string }[] = [];
  if (attachments.length === 0) return { downloaded, failed };

  fs.mkdirSync(destDir, { recursive: true });

  const usedNames = new Set<string>();

  for (const attachment of attachments) {
    try {
      const sanitized = sanitizeFilename(attachment.name);
      const filename = dedupeFilename(sanitized, usedNames);
      usedNames.add(filename);

      const url = `https://open.larksuite.com/open-apis/drive/v1/medias/${attachment.fileToken}/download`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Lark download error ${response.status}: ${await response.text()}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(path.join(destDir, filename), buffer);
      downloaded.push(filename);
    } catch (err) {
      failed.push({ name: attachment.name, error: (err as Error).message });
    }
  }

  return { downloaded, failed };
}

/** Strips path separators and other filesystem-unsafe characters from an attachment's name. */
function sanitizeFilename(name: string): string {
  const base = name.replace(/[/\\]/g, '_').replace(/[<>:"|?*\x00-\x1f]/g, '_').trim();
  return base || 'attachment';
}

/** Appends a numeric suffix before the extension on collision with an already-used filename. */
function dedupeFilename(filename: string, used: Set<string>): string {
  if (!used.has(filename)) return filename;

  const ext = path.extname(filename);
  const stem = filename.slice(0, filename.length - ext.length);
  let n = 2;
  let candidate = `${stem}-${n}${ext}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${stem}-${n}${ext}`;
  }
  return candidate;
}

/**
 * Writes one or more newly allocated feature IDs back onto a ticket's Feature ID field,
 * appending rather than overwriting any feature IDs already present. All new IDs are folded
 * into a single write — the Lark PUT replaces the field's value wholesale, so appending them
 * one call at a time would drop everything but the last.
 *
 * When `ticket.featureIdFieldIsLink` is set (detected by `fetchTicket()` via `isLinkField()`),
 * the field is a Bitable Link field pointing at the Features table — writing plain text to it
 * fails with Lark error 1254067 `LinkFieldConvFail`, so the write uses `record_id`s instead.
 * Each new feature ID must have a corresponding Features-table `record_id` in
 * `newFeatureRecordIds` (populated by `syncFeatureToLarkTable()`, which callers are expected to
 * run first for every ID being written) — this throws if one is missing rather than silently
 * dropping it. Otherwise the field holds a comma-joined string or an array of plain strings,
 * matching what `fetchTicket` reads for a non-link field.
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
  newFeatureRecordIds?: Map<string, string>,
): Promise<void> {
  const existing = ticket.rawFields[featureIdField];
  const fields: Record<string, unknown> = {};

  if (ticket.featureIdFieldIsLink) {
    const existingRecordIds = extractLinkRecordIds(existing);
    const newRecordIds = newFeatureIds.map((id) => {
      const recordId = newFeatureRecordIds?.get(id);
      if (!recordId) {
        throw new Error(
          `'${featureIdField}' is a Link field, but no Lark Features-table record_id was resolved for '${id}' ` +
            `(requires lark.features_table_id and lark.sync_new_features to be configured/enabled).`,
        );
      }
      return recordId;
    });
    fields[featureIdField] = [...existingRecordIds, ...newRecordIds];
  } else if (Array.isArray(existing)) {
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
 * Returns the created record's `record_id` — needed to write `feature_id_field` back onto a
 * ticket when it's a Link field (see `updateTicketFeatureId()`'s `options.isLinkField`).
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
): Promise<string> {
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

  const data = (await response.json()) as {
    code: number;
    msg?: string;
    data?: { record?: { record_id?: string } };
  };

  if (!response.ok || data.code !== 0) {
    throw new Error(`Lark create error ${data.code ?? response.status}: ${data.msg ?? 'unknown error'}`);
  }

  const recordId = data.data?.record?.record_id;
  if (!recordId) {
    throw new Error('Lark create error: response was missing the created record_id');
  }
  return recordId;
}

/**
 * Looks up whether `featureId` already has a record in the Lark Features table, returning its
 * `record_id` if so. Used by `syncFeatureToLarkTable()` to decide whether to create one —
 * checking Lark directly, rather than trusting local `docs/features/<id>/` presence as a proxy,
 * is what lets that function backfill a record for a feature whose docs already existed locally
 * but whose Lark write never happened (e.g. generated before `features_table_id` was
 * configured, or a prior sync attempt failed). The `record_id` (rather than a plain boolean) is
 * also what `updateTicketFeatureId()` needs to write a Link-typed `feature_id_field`.
 */
async function findFeatureRecordId(
  featureId: string,
  baseId: string,
  tableId: string,
  featureIdField: string,
  token: string,
): Promise<string | undefined> {
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

  const data = (await response.json()) as {
    code: number;
    msg?: string;
    data?: { total?: number; items?: { record_id: string }[] };
  };

  if (!response.ok || data.code !== 0) {
    throw new Error(`Lark search error ${data.code ?? response.status}: ${data.msg ?? 'unknown error'}`);
  }

  return data.data?.items?.[0]?.record_id;
}

/**
 * Non-fatal, idempotent sync of one feature into the Lark Features table. No-ops (returning
 * `undefined`) when `lark.features_table_id` is unset or `lark.sync_new_features` is disabled.
 * Otherwise checks Lark first via `findFeatureRecordId()` and only creates a record when one
 * isn't already there — so callers can call this for every feature a command touches, not just
 * ones whose local docs directory was just created, and a feature with existing docs but a
 * missing Lark record still gets backfilled. A create (or lookup) failure is reported but never
 * thrown, so it can't fail the invoking command — same non-fatal intent as the
 * `sync_feature_id` write-back.
 *
 * Returns the Features-table `record_id` (pre-existing or newly created), or `undefined` if
 * sync was skipped or failed. Callers writing a Link-typed `feature_id_field` back onto a
 * ticket (`updateTicketFeatureId()`'s `options.isLinkField`) need this record_id to do so.
 */
export async function syncFeatureToLarkTable(
  config: Config,
  larkToken: string,
  featureId: string,
  title: string,
  projectRecordIds?: string[],
): Promise<string | undefined> {
  if (!config.lark.features_table_id) return undefined;
  if (!config.lark.sync_new_features) return undefined;

  try {
    const existingRecordId = await findFeatureRecordId(
      featureId,
      config.lark.base_id,
      config.lark.features_table_id,
      config.lark.features_table_feature_id_field,
      larkToken,
    );
    if (existingRecordId) return existingRecordId;

    const recordId = await createFeatureRecord(
      featureId,
      title,
      config.lark.base_id,
      config.lark.features_table_id,
      larkToken,
      config.lark,
      projectRecordIds,
    );
    printInfo(`Synced feature ${featureId} to Lark Features table.`);
    return recordId;
  } catch (err) {
    printWarn(
      `Failed to sync feature ${featureId} to Lark Features table: ${(err as Error).message}. Continuing.`,
    );
    return undefined;
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
    uiDesignField: z.string().optional(),
    attachmentField: z.string().optional(),
  }),
  execute: async ({
    ticketId,
    baseId,
    tableId,
    featureIdField,
    titleField,
    projectField,
    token,
    uiDesignField,
    attachmentField,
  }) => {
    const ticket = await fetchTicket(
      ticketId,
      baseId,
      tableId,
      featureIdField,
      titleField,
      projectField,
      token,
      uiDesignField,
      attachmentField,
    );
    return ticket;
  },
});
