## Context

`src/tools/lark.ts` already has a non-fatal write-back pattern for the Feature ID field (`updateTicketFeatureId()`, called from `startFromTicket()` in `src/cli/start.ts`, guarded by `config.lark.sync_feature_id`). This change adds a second, independent write-back for the ticket's status field, following the same shape. See proposal.md for motivation.

Lark Bitable single-select fields read and write as a plain string (the option's display text) — unlike the Feature ID field here, which is a plain text/multi-line field the code treats as string-or-array. Status is simpler: one string in, one string out.

## Goals / Non-Goals

**Goals:**
- Update the ticket's status to a configurable "in dev" value after a successful `lv start <ticket-id>` run, unless it's already there.
- Match the existing Feature ID sync's failure handling exactly: never fail the command, just warn.

**Non-Goals:**
- Managing any other ticket status transition (e.g. moving to "Done", "In Review"). This change only ever writes one value, on start.
- Validating that the configured `in_dev_status_value` is a valid option on the Lark single-select field — an invalid option name is treated like any other Lark write failure (reported, non-fatal).

## Decisions

- **Read current status from `ticket.rawFields`, not a new `fetchTicket()` parameter.** `fetchTicket()` already returns `rawFields: Record<string, unknown>` with every column. Reading `ticket.rawFields[config.lark.status_field]` in `start.ts` avoids widening `fetchTicket()`'s signature and `LarkTicket` interface for a value only this one call site needs. Alternative considered: add a `status` field to `LarkTicket` like `featureIds`/`title` — rejected as unnecessary indirection for a single read used once.
- **Comparison is a strict string equality**, not case-insensitive. Lark single-select values are exact option names; a mismatch (including case) means the option is genuinely different, and forcing a write in that case is the correct default — silently normalizing case could mask a misconfigured `in_dev_status_value`.
- **New `updateTicketStatus()` function**, separate from `updateTicketFeatureId()`, mirroring its shape (build a one-field `fields` object, PUT to the same record endpoint, throw on failure). Not merged into one generic "update ticket field" helper — two call sites with different field-shape handling (array-or-string append vs. plain string replace) don't justify a shared abstraction yet.
- **Placement in `startFromTicket()`**: called after the existing Feature ID sync block (after branch name is computed, ticket already fetched), guarded by `config.lark.sync_status` and the current-status check, independently of whether the ticket had any feature IDs to sync. It runs for every ticket-based start, not just ones that allocated a new feature.

## Risks / Trade-offs

- [Ticket's status field uses a different type than single-select, e.g. plain text] → Same write path (a string field value) works either way; no extra handling needed.
- [Race: ticket status changed in Lark between fetch and write, e.g. someone else just moved it] → Acceptable; `lv start` writes the configured value regardless, same last-write-wins behavior the Feature ID sync already has.
