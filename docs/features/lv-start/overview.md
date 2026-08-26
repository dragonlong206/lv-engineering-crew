<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv start

`lv start` creates a change context in `docs/changes/<change-id>/state.yaml` and prepares a branch for that change. It supports two entry modes: starting from a Lark Base ticket ID or starting from free text with `--description`. In ticket mode it fetches ticket data from Lark, uses the ticket title for the branch summary, records the ticket-backed context in state, and can update Lark with newly allocated feature IDs. In description mode it skips Lark entirely, derives a short title from the description, and creates the same state file and branch workflow from local text.

## Main components

- `src/index.ts` registers `lv start [ticket-id]` with `--type <type>` and `--description <description>`.
- `src/cli/start.ts` contains the `runStart()` orchestration and the ticket-based and description-based entry paths.
- `src/tools/lark.ts` fetches tickets from Lark Base, updates a ticket's Feature ID field, and can create feature records in a Lark Features table.
- `src/engine/branch-naming.ts` renders branch names from configured branch patterns and slugifies summaries.
- `src/engine/feature-id.ts` allocates new feature IDs from the repository's existing feature namespace.
- `src/cli/bootstrap.ts` generates feature docs for missing feature directories during ticket-based starts.
- `src/engine/state-io.ts` writes `docs/changes/<change-id>/state.yaml`.
- `src/integrations/git/client.ts` creates the branch, stages all changes, commits, and pushes.
- `src/config.ts` resolves repository paths and loads `.lv.yaml` and `.lv.local.yaml`.
- `src/types.ts` defines the persisted state and config schemas, including the Lark sync flags.

## High-level flow

1. Resolve configuration and repository root.
2. If a ticket ID was provided, require Lark credentials and fetch the ticket from Lark Base.
3. Render the branch name from the configured branch type and the ticket title, or from a description-derived change ID for free-text starts.
4. For ticket-based starts, inspect the ticket's Feature ID field.
5. If the ticket has no feature IDs, try to match the change to an existing feature. If no match is accepted, infer one or more new features, allocate new feature IDs, and keep those IDs local unless Lark sync is enabled.
6. For any referenced feature whose `docs/features/<id>/` directory is missing, generate feature docs inline from a repository scan and prompt for confirmation before continuing.
7. If new feature IDs were allocated and `lark.sync_feature_id` is enabled, try to write them back to the ticket. Failures are non-fatal.
8. Create the branch from `config.default_branch`.
9. Write `docs/changes/<change-id>/state.yaml` with the change metadata.
10. Stage all repository changes, commit them, and then attempt to push the branch to `origin`.
11. Print the created context path and the next-step hint for the OpenSpec workflow.

## Constraints and assumptions

- The command accepts either `lv start <ticket-id>` or `lv start --description "..."`.
- `--type` selects a branch type from `branch_types` or from the built-in defaults when `branch_types` is unset.
- Ticket-based starts use the ticket ID as the change ID in state and commit messages.
- Description-based starts derive the change ID from the first line of the description, slugified with underscores instead of hyphens so it can stand in for `{ticket_id}` in branch patterns.
- A ticket with no Feature ID can still start a change. The command will try to reuse an existing feature first, then infer and allocate new feature IDs if needed.
- Missing feature docs are generated only for feature directories that do not already exist, and the command pauses for confirmation before continuing.
- `commitAll()` stages every dirty path in the repository, so unrelated local changes can be included in the `lv start` commit.
- Git push failures are tolerated and leave the local branch and commit in place.
- Lark access tokens are fetched per invocation and are not cached across runs.
- Newly allocated feature IDs are only written back to Lark when `lark.sync_feature_id` is enabled.

## Current state of the code

`lv start` is implemented in `src/cli/start.ts` and registered in `src/index.ts`. The current implementation supports both ticket-backed and free-text starts, includes inline feature doc generation for missing feature directories, and does best-effort sync back to Lark when feature IDs are allocated. The persisted state schema records `ticket_id` only for ticket-based starts, plus the title, description, feature IDs, branch, creation time, and `lv_version`.