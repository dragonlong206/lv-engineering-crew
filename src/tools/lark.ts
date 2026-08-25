import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

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
