import type { Ticket } from "../integrations/tickets/types.js";

/**
 * Folds a parent ticket's reference material into a sub-ticket, for `lv start` on a ticket
 * linked to a parent via `lark.subtask_parent_field`. Only `uiDesignRefs` (ordered union, the
 * sub-ticket's own first) and `attachments` (sub-ticket's own first, deduped by `fileToken` so
 * a file both reference downloads once) are merged — title, description, IDs, and `raw` stay the
 * sub-ticket's own, since those define the change's scope and drive every write-back. The
 * parent's title/description are recorded separately as `state.yaml`'s `parent` block instead.
 */
export function mergeParentContext(ticket: Ticket, parent: Ticket): Ticket {
  const uiDesignRefs = [...ticket.uiDesignRefs];
  for (const ref of parent.uiDesignRefs) {
    if (!uiDesignRefs.includes(ref)) uiDesignRefs.push(ref);
  }

  const seenTokens = new Set(ticket.attachments.map((a) => a.fileToken));
  const attachments = [...ticket.attachments];
  for (const attachment of parent.attachments) {
    if (seenTokens.has(attachment.fileToken)) continue;
    seenTokens.add(attachment.fileToken);
    attachments.push(attachment);
  }

  return { ...ticket, uiDesignRefs, attachments };
}
