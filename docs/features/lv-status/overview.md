<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

<!-- AUTO-GENERATED — verified from repository code. -->

# lv status

`lv status` prints the current change context for the branch you are on. It is a read-only command that resolves the active branch to a change ID, loads that change's `state.yaml`, and prints a short human-readable summary. It also emits OpenSpec next-action guidance for any OpenSpec changes recorded in the persisted state.

## Purpose

The command exists so an engineer can quickly inspect the persisted change state without opening files manually. It is meant for change branches only. If the current branch does not match LV's configured branch naming rules, the command exits with an error.

## Main components

- `src/cli/status.ts` runs the command.
- `src/engine/branch-naming.ts` is used to recognize the current branch and recover the change's ticket ID.
- `src/engine/state-io.ts` reads `state.yaml` from `docs/changes/<change-id>/`.
- `src/cli/status.ts` contains `printStateSummary()`, which formats the output and is reused by `lv resume`.
- `src/integrations/openspec/client.ts` is queried for per-change OpenSpec next actions after the summary is printed.

## High-level flow

1. Load repository configuration and locate the repo root.
2. Read the current git branch.
3. Match the branch against configured change-branch patterns.
4. If the branch is not a change branch, print an error and exit non-zero.
5. Use the matched ticket ID as the change ID.
6. Read `docs/changes/<change-id>/state.yaml`.
7. Print the state summary for that change.
8. Inspect `state.openspec_changes` and print a next-action suggestion for each recorded OpenSpec change.
9. If no OpenSpec changes are recorded, print a single prompt to start planning.

## Constraints and assumptions

- The command only works when the current branch is recognized as a change branch.
- The change ID is derived from the branch's ticket ID, not from a path argument or user prompt.
- `state.yaml` must exist and must conform to `StateSchema`; otherwise `readState()` throws.
- The output is intentionally minimal and text-based. It is not a machine-readable API.
- `ticket_id` is optional in the stored state, so status may print a change ID without a separate ticket field.
- OpenSpec guidance is best-effort. If OpenSpec status lookup fails for a change name, the command prints a fallback message instead of failing the whole command.

## Current state of the code

`lv status` is implemented and wired through the CLI entrypoint. The current implementation prints a blank line, then:

- `Change`
- `Ticket` when `ticket_id` exists
- `Title`
- `Description`
- `Features`
- `Branch`
- `Created`
- `Version`

After that, it prints OpenSpec next actions based on `state.openspec_changes`:

- no recorded OpenSpec changes: `Next action: run /opsx:propose to start planning.`
- incomplete OpenSpec change: prints the remaining next steps returned by `getChangeStatus()`
- complete but not yet applied: suggests `/opsx:apply` with the remaining task count
- complete and fully applied: suggests `/opsx:archive`
- lookup failure: prints that the next action could not be determined

It does not print step progress, iterations, token counts, durations, approvals, or any per-step workflow fields. The persisted state schema currently contains only the change metadata fields above plus `openspec_changes` and `lv_version`.
