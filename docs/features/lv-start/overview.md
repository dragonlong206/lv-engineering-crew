<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv start

`lv start` creates a change context for a new LV workflow run. It writes `docs/changes/<change-id>/state.yaml`, creates a Git branch, stages and commits the resulting context, and then prints the path to the state file with an OpenSpec next-step hint. The command can start from a Lark Base ticket ID or from free text via `--description`.

Ticket-based starts fetch the ticket from Lark Base, use the ticket title in the branch name, record the ticket data in state, optionally sync newly allocated feature IDs back to the ticket, and optionally update the ticket status to the configured in-dev value. Description-based starts skip Lark, derive a short title from the first line of the description, and use that text to build the same branch and state workflow.

## Main components

- `src/index.ts` registers `lv start [ticket-id]` with `--type <type>` and `--description <description>`.
- `src/cli/start.ts` contains `runStart()` and the ticket-based and description-based entry paths.
- `src/tools/lark.ts` fetches tickets from Lark Base, updates a ticket's Feature ID field, updates ticket status, and syncs feature records to the Lark Features table when configured.
- `src/engine/branch-naming.ts` renders branch names from configured patterns and slugifies summaries.
- `src/engine/feature-id.ts` allocates new feature IDs from the repository's existing feature namespace and lists existing feature docs for matching.
- `src/cli/bootstrap.ts` generates feature docs for missing feature directories during start.
- `src/engine/state-io.ts` writes `docs/changes/<change-id>/state.yaml`.
- `src/integrations/git/client.ts` creates the branch and commits the resulting working tree state.
- `src/config.ts` resolves repository paths and loads `.lv.yaml` and `.lv.local.yaml`.
- `src/types.ts` defines the persisted state and config schemas, including the Lark sync flags.

## High-level flow

1. Load repository config and resolve the repo root.
2. If a ticket ID was provided, require Lark app credentials and fetch the ticket from Lark Base.
3. Render the branch name from the configured branch type and the ticket title, or from a description-derived change ID for free-text starts.
4. For ticket-based starts, inspect the ticket's Feature ID field.
5. If the ticket has no feature IDs, try to match the change to an existing feature. If no match is accepted, infer one or more new feature titles, allocate matching feature IDs, and keep those IDs local unless Lark sync is enabled.
6. For any referenced feature whose `docs/features/<id>/` directory is missing, generate feature docs inline from a repository scan and prompt for confirmation before continuing.
7. Sync referenced features to the Lark Features table when configured, then write any newly allocated feature IDs back to the ticket when `lark.sync_feature_id` is enabled. Failures are non-fatal.
8. Create the branch from `config.default_branch`.
9. Write `docs/changes/<change-id>/state.yaml` with the change metadata.
10. Stage all repository changes and commit them.
11. Print the created context path and the next-step hint for the OpenSpec workflow.

## Constraints and assumptions

- The command accepts either `lv start <ticket-id>` or `lv start --description "..."`.
- `--type` selects a branch type from `branch_types`, or from the built-in defaults when `branch_types` is unset.
- Ticket-based starts use the ticket ID as the change ID in state and commit messages.
- Description-based starts derive the change ID from the first line of the description, slugified with underscores instead of hyphens so it can stand in for `{ticket_id}` in branch patterns.
- A ticket with no Feature ID can still start a change. The command tries to reuse an existing feature first, then infer and allocate new feature IDs if needed.
- Missing feature docs are generated only for feature directories that do not already exist, and the command pauses for confirmation before continuing.
- `commitAll()` stages every dirty path in the repository, so unrelated local changes can be included in the `lv start` commit.
- Lark access tokens are fetched per invocation and are not cached across runs.
- Newly allocated feature IDs are only written back to Lark when `lark.sync_feature_id` is enabled.
- Ticket status sync is best effort and only runs when `lark.sync_status` is enabled.
- When a referenced feature already exists in docs, `lv start` still syncs it to the Lark Features table if that sync is configured.

## Current state of the code

`lv start` is implemented in `src/cli/start.ts` and registered in `src/index.ts`. The current implementation supports both ticket-backed and free-text starts, includes inline feature doc generation for missing feature directories, performs best-effort sync back to Lark for newly allocated ticket feature IDs, updates ticket status when configured, and syncs referenced features into the Lark Features table when configured. The persisted state schema records `ticket_id` only for ticket-based starts, plus the title, description, feature IDs, branch, creation time, and `lv_version`.