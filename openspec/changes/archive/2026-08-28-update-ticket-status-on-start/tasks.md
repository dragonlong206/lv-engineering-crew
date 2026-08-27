## 1. Config

- [x] 1.1 Add `status_field` (default `"Status"`), `in_dev_status_value` (default `"In Dev"`), and `sync_status` (default `true`) to `LarkConfigSchema` in `src/types.ts`, and verify `npx tsc --noEmit` passes

## 2. Lark integration

- [x] 2.1 Add `updateTicketStatus(ticket, newStatus, baseId, tableId, statusField, token)` to `src/tools/lark.ts`, mirroring `updateTicketFeatureId()`'s PUT-and-throw-on-failure shape, and verify it type-checks
- [x] 2.2 Verify the function builds a single-field `{ [statusField]: newStatus }` body rather than the array-or-string append logic `updateTicketFeatureId()` uses (status is a plain string replace)

## 3. `lv start` wiring

- [x] 3.1 In `startFromTicket()` (`src/cli/start.ts`), after the existing Feature ID sync block, read the ticket's current status from `ticket.rawFields[config.lark.status_field]` and compare (strict string equality) against `config.lark.in_dev_status_value`
- [x] 3.2 When `config.lark.sync_status` is enabled and the current status differs from the target, call `updateTicketStatus()`; on success print a success message, on failure `printWarn()` and continue (do not throw) — implemented and type-checked; live verification against a real ticket deferred, see note below
- [x] 3.3 When `config.lark.sync_status` is disabled, skip the write entirely — implemented (gated by the outer `if (config.lark.sync_status)`) and type-checked; live verification deferred, see note below
- [x] 3.4 When the ticket's current status already equals `config.lark.in_dev_status_value`, verify no write is issued — confirmed by code inspection: the `currentStatus !== config.lark.in_dev_status_value` guard skips the call entirely in that case
- [x] 3.5 Verify `startFromDescription()` is untouched and performs no status read/write (no ticket exists in that path)

## 4. Docs

- [x] 4.1 Run `lv bootstrap lv-start` to refresh `docs/features/lv-start/{overview.md,design.md}` with the new status-sync step, and review the diff before committing
