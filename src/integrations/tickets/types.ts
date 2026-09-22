/**
 * Source-agnostic ticket shape `lv start` operates on, produced by a `TicketSource`. Fields
 * that only make sense for the source that produced a given ticket (e.g. Lark Projects-table
 * link IDs) are kept opaque here rather than typed precisely — see `projectRefs`/`raw` below —
 * so this type doesn't grow a union of every ticket system's quirks as sources are added.
 */
export interface Ticket {
  id: string;
  title: string;
  description: string;
  featureIds: string[];
  uiDesignRefs: string[];
  attachments: { fileToken: string; name: string }[];
  // Opaque project linkage, meaningful only to the source that produced this ticket and to
  // `syncFeatureToLarkTable()` (not part of this interface — see design.md's Non-Goals). A
  // source with no equivalent concept returns `[]`.
  projectRefs: string[];
  // Opaque source-specific state a write-back method on the same `TicketSource` may need back
  // (e.g. Lark's `featureIdFieldIsLink` + raw field values). Never read outside the source that
  // produced this ticket.
  raw: unknown;
}

/**
 * Normalizes "fetch/update a ticket" behind a source-agnostic interface (Dependency Inversion),
 * so `lv start`'s orchestration in `src/cli/start.ts` doesn't call any one ticket system's API
 * directly. `LarkTicketSource` (`./lark-ticket-source.js`) is the only implementation today —
 * see proposal.md/design.md for why a second source and a config-driven selector are out of
 * scope for now.
 *
 * `updateFeatureId`/`updateStatus` never throw for expected failure modes (write-back disabled
 * by config, or the underlying API call failing) — each implementation treats those as
 * non-fatal and reports its own outcome (success/warning/disabled) via the `cli/helpers.js`
 * print functions, in its own words.
 */
export interface TicketSource {
  fetch(ticketId: string): Promise<Ticket>;
  downloadAttachments(
    ticket: Ticket,
    destDir: string,
  ): Promise<{ downloaded: string[]; failed: { name: string; error: string }[] }>;
  updateFeatureId(
    ticket: Ticket,
    featureIds: string[],
    featureRecordIds: Map<string, string>,
  ): Promise<void>;
  updateStatus(ticket: Ticket): Promise<void>;
}
