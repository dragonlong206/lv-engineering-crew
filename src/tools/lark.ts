import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export interface LarkTicket {
  id: string;
  title: string;
  description: string;
  featureIds: string[];
  rawFields: Record<string, unknown>;
}

export async function fetchTicket(
  ticketId: string,
  baseId: string,
  tableId: string,
  featureIdField: string,
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

  const title = typeof fields['Title'] === 'string' ? fields['Title'] :
    typeof fields['Name'] === 'string' ? fields['Name'] :
    typeof fields['title'] === 'string' ? fields['title'] : ticketId;

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
    token: z.string(),
  }),
  execute: async ({ ticketId, baseId, tableId, featureIdField, token }) => {
    const ticket = await fetchTicket(ticketId, baseId, tableId, featureIdField, token);
    return ticket;
  },
});
