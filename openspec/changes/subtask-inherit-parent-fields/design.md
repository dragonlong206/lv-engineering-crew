## Context

`LarkTicketSource.createSubtickets()` (`src/integrations/tickets/lark-ticket-source.ts`) calls `createSubticket()` (`src/tools/lark.ts`) per sub-task, which POSTs only `{title_field, Description, subtask_parent_field}`. The parent `Ticket` carries `raw.ticket.rawFields` — the unmodified Bitable field map — plus `featureIdFieldIsLink`. Read and write shapes differ per Bitable field type: link fields read as `[{record_ids, text_arr, ...}]` but write as `["recXXX"]`; person fields read as `[{id, name, ...}]` and write as `[{id}]`.

There is no automated test suite (see CLAUDE.md); verification is `tsc --noEmit`, build, and a scripted check.

## Goals / Non-Goals

**Goals:**
- Sub-tickets created by a split carry the parent's features, project, assignee and order.
- Inheritance never blocks sub-ticket creation.

**Non-Goals:**
- Inheriting other fields (status, priority, dates, labels).
- Retro-fitting already-created sub-tickets.
- Changing how `lv start <sub-ticket-id>` reads a sub-ticket (it already reads features/project from the record).

## Decisions

1. **Build inherited fields from the parent's `rawFields` in a new `buildInheritedFields()` helper in `src/tools/lark.ts`**, rather than adding more parsed properties to `LarkTicket`. Only fields we write back need conversion; the raw map already has everything. Alternative (extend `LarkTicket` with `assignee`/`order`) rejected: it widens the shared `Ticket` interface for a Lark-only write concern.

2. **Per-type conversion:**
   - Features: if `featureIdFieldIsLink`, write `extractLinkRecordIds(raw)`; otherwise copy the raw string/array value as-is.
   - Project: write `extractLinkRecordIds(raw[project_field])` (project is a link field, same as `fetchTicket()` assumes).
   - Assignee: read `[{id}]` from the person field and write `[{id}]` (drop name/email/avatar).
   - Order: copy the raw value unchanged (number or text).
   Empty/undefined results are omitted from the POST body.

3. **Two new optional config keys, `lark.assignee_field` and `lark.order_field`**, with no defaults. Column names for these vary per Base and there is no safe default; unset means "don't inherit", matching how `ui_design_field`/`attachment_field` behave. Feature and project reuse the already-configured `feature_id_field`/`project_field`, so they inherit without new config.

4. **Single retry without inherited fields.** If a create call fails (e.g. a field type mismatch rejects the whole record), `createSubtickets()` retries once with only title/description/parent link and warns which inheritance was skipped. This keeps the existing guarantee that a sub-ticket is still created. Alternative (fail the sub-task) rejected as a regression from today's behavior.

## Risks / Trade-offs

- Field-type guesses (person, order) may not match every Base → mitigated by the retry-without-inheritance fallback and a warning.
- Copying assignee means the parent's assignee owns all sub-tasks; the user explicitly asked for this.
- The retry can mask a persistent misconfiguration; the warning names the skipped fields so it is visible.
