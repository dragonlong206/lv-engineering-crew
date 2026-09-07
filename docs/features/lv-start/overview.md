<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv start

`lv start` creates the initial change context for a new LV workflow run. It writes `docs/changes/<change-id>/state.yaml`, creates or reuses a Git branch for that change, stages and commits the resulting context, and prints the state file path with a reminder to continue through the OpenSpec workflow.

The command supports two entry modes:

- Ticket-backed start from a Lark Base record ID.
- Description-backed start from free text via `--description`.

Ticket-backed starts fetch the ticket from Lark Base, use the ticket title in the branch name, persist ticket metadata in state, and can optionally sync newly allocated feature IDs back to the ticket. They can also update the ticket status to the configured in-dev value. Description-backed starts skip Lark, derive a short title from the first line of the description, and use that as the basis for the change ID, branch name, and persisted state.

## Main components

- `src/index.ts` registers `start [ticket-id]` with `--type <type>` and `--description <description>`.
- `src/cli/start.ts` contains `runStart()` and both start flows, plus the existing-branch resume or restart handling.
- `src/tools/lark.ts` fetches tickets from Lark Base, updates ticket Feature ID values, updates ticket status, and syncs feature records to a Lark Features table when configured.
- `src/engine/branch-naming.ts` renders branch names from configured patterns, slugifies summaries, and matches existing branches back to a change ID.
- `src/engine/feature-id.ts` allocates new feature IDs and enumerates existing feature docs for matching.
- `src/cli/bootstrap.ts` generates feature doc placeholders for missing feature directories during `lv start`.
- `src/engine/state-io.ts` writes and reads `docs/changes/<change-id>/state.yaml`.
- `src/integrations/git/client.ts` creates, checks out, deletes, stages, commits, and pushes Git branches.
- `src/types.ts` defines the persisted state and configuration schemas, including the Lark sync settings.

## High-level flow

1. Load repository configuration and resolve the repo root.
2. Check whether a branch already exists for the target change ID. If it does, prompt to resume or restart before any Lark or LLM work.
3. For ticket-based starts, require Lark app credentials, fetch the ticket, and build the branch name from the ticket title.
4. For description-based starts, derive a title from the first line of the description, convert it into a change ID, and render the branch name from that value.
5. Determine the feature IDs to associate with the change. If a ticket already has feature IDs, use them. If it has none, try to match existing features, otherwise infer one or more new feature titles and allocate new IDs.
6. For any referenced feature whose `docs/features/<id>/` directory is missing, generate placeholder feature docs and prompt for confirmation before continuing.
7. Sync referenced features to the Lark Features table when enabled, then write any newly allocated feature IDs back to the ticket when ticket sync is enabled. These writes are best effort.
8. Update the ticket status when status sync is enabled and the current value differs from the configured in-dev value.
9. Create the branch if needed, write `docs/changes/<change-id>/state.yaml`, stage the repository, and commit the change context.
10. Print the context path and the OpenSpec next-step hint.

## Constraints and assumptions

- The command accepts either `lv start <ticket-id>` or `lv start --description "..."`.
- `--type` selects a branch type from `branch_types`, or from the built-in default branch types when `branch_types` is unset.
- Ticket-backed starts use the ticket ID as the change ID for state storage and commit messages.
- Description-backed starts derive the change ID from the first line of the description and replace hyphens with underscores so the value can stand in for `{ticket_id}` in branch patterns.
- A ticket with no Feature ID can still start a change. The command first tries to reuse existing feature docs, then infers and allocates new feature IDs if needed.
- Missing feature docs are generated only for feature directories that do not already exist, and the command pauses for confirmation before continuing.
- `commitAll()` stages every dirty path in the repository, so unrelated local changes can be included in the `lv start` commit.
- Lark access tokens are fetched per invocation and are not cached across runs.
- Newly allocated feature IDs are only written back to Lark when `lark.sync_feature_id` is enabled.
- Ticket status sync is best effort and only runs when `lark.sync_status` is enabled.
- Existing feature docs are still synced to the Lark Features table when feature-table sync is configured.
- If a matching branch already exists, `lv start` can resume on it instead of creating a new branch.

## Current state of the code

`lv start` is implemented in `src/cli/start.ts` and registered in `src/index.ts`. The current implementation supports both ticket-backed and free-text starts, existing-branch resume or restart, placeholder feature doc generation for missing feature directories, best-effort sync of new feature IDs back to Lark, ticket status updates when configured, and syncing referenced features into the Lark Features table when configured. The persisted state schema currently includes `ticket_id` only for ticket-based starts, plus `title`, `description`, `feature_ids`, `branch`, `created_at`, `lv_version`, `openspec_changes`, and optional `ui_design`.