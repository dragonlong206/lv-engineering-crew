## Why

Ticket-based `lv start` runs create the branch, state file, and feature sync, but never touch the ticket's own status field in Lark. Engineers currently have to remember to flip the ticket to "In Dev" by hand, so tickets sit in their pre-start status (e.g. "To Do") after work has actually begun.

## What Changes

- `lv start <ticket-id>` now updates the ticket's status field in Lark Base to a configurable "in dev" value once the ticket is confirmed to not already be in that status.
- Adds Lark config: `lark.status_field` (column name, defaults to `"Status"`), `lark.in_dev_status_value` (target value, defaults to `"In Dev"`), and `lark.sync_status` (enable/disable, defaults to `true`).
- The status write is skipped when the ticket's current status already equals the configured target value, and is skipped entirely when `lark.sync_status` is disabled.
- Like the existing Feature ID write-back, a failed status update is reported but does not fail `lv start` — the command completes the branch, state, and commit regardless.
- Description-based starts (`lv start --description "..."`) are unaffected — there is no Lark ticket to update.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `lv-start`: adds a new sub-capability, `lv-start/ticket-status-sync`, covering the status write-back behavior (configurability, skip-if-already-set, non-fatal failure), following the same delta-spec convention as the existing `lv-start/lark-feature-id-sync` sub-capability.

## Impact

- `src/tools/lark.ts`: new `updateTicketStatus()` function (PUT to the Bitable record, same shape as `updateTicketFeatureId()`), and reading the ticket's current status field value.
- `src/types.ts`: `LarkConfigSchema` gains `status_field`, `in_dev_status_value`, `sync_status`.
- `src/cli/start.ts`: `startFromTicket()` calls the status write-back after the existing feature-ID sync step, guarded by `config.lark.sync_status` and a current-status check.
- `docs/features/lv-start/{overview.md,design.md}`: refreshed via `lv bootstrap lv-start` after implementation (per the archive guidance convention already wired into this repo).
