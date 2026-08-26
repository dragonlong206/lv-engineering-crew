<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv start

Starts a change from either a Lark Base ticket or free text. For ticket-based starts, it fetches the ticket, derives a branch name from the ticket ID and title, allocates and optionally syncs a feature ID when the ticket has none, generates inline feature docs for any missing feature directories, creates the branch, writes the initial change state and analysis prompt output, commits the result, and then attempts to push the branch.

## Main components

- `src/index.ts` registers `lv start [ticket-id]` with `--type <type>` and `--description <description>`.
- `src/cli/start.ts` orchestrates both ticket-based and description-based start flows.
- `src/tools/lark.ts` fetches the ticket from Lark Base and can write an allocated feature ID back to the ticket.
- `src/engine/branch-naming.ts` renders the branch name from config, the ticket or change ID, and the ticket title or derived summary.
- `src/engine/feature-id.ts` allocates new `Fxxxx` feature IDs from existing `docs/features/` directories.
- `src/cli/bootstrap.ts` exposes `generateFeatureDocsFromScan()`, which generates `overview.md`, `design.md`, and `requirements.md` for a feature directory from a repository scan.
- `src/engine/state-io.ts` writes the workflow state file under `docs/changes/<change-id>/state.yaml`.
- `src/integrations/git/client.ts` creates the branch, stages and commits changes, and pushes to `origin`.
- `src/config.ts` resolves repository paths and loads `.lv.yaml` and `.lv.local.yaml`.
- `src/types.ts` defines the persisted state and config schema, including the `lark.sync_feature_id` flag.

## High-level flow

1. Load configuration and resolve the repository root.
2. For ticket-based starts, require Lark app credentials and exchange them for a tenant access token.
3. Fetch the ticket record from Lark Base using the configured base, table, feature field, and title field.
4. Render the branch name from the configured branch type, the ticket or change ID, and the title or derived summary.
5. For ticket-based starts, if the ticket has no Feature ID, allocate exactly one new feature ID and treat it as a local feature reference for the rest of the run.
6. For each referenced feature ID that does not yet have a `docs/features/<id>/` directory, generate feature docs inline from a repository scan, seeded with the ticket title and description.
7. If any feature docs were generated, print their paths and prompt for confirmation before continuing. Declining stops the command before branch creation or commit.
8. If a new feature ID was allocated and `lark.sync_feature_id` is enabled, attempt to write it back to the Lark ticket. Sync failures are non-fatal.
9. Create the branch from `config.default_branch`.
10. Write the initial state file and the generated analysis or change context under `docs/changes/<change-id>/`.
11. Stage and commit all repository changes, then attempt to push the branch to `origin`.
12. Print a success message and the path to the created change context.

## Constraints and assumptions

- The command supports two entry modes: `lv start <ticket-id>` and `lv start --description "..."`.
- `--type` must match a configured branch type key, or one of the built-in defaults when `branch_types` is unset.
- Ticket-based starts use the ticket ID as the change ID and the ticket title as the branch summary when available.
- Description-based starts derive a short title from the first line of the description, use a slugified version of that title as the change ID, and do not require Lark access.
- A ticket with no Feature ID is treated as introducing exactly one new feature. If the ticket introduces more than one new feature, the remaining feature IDs must already exist in Lark or in the repository.
- Inline feature doc generation runs only for missing feature directories and is based on the ticket title and description, so it may require human review before continuing.
- `commitAll()` stages all tracked and untracked changes in the repository, not just the files created by `lv start`.
- Push failures are tolerated. If `git push` fails, the local branch and commit remain in place.
- The Lark access token is fetched per invocation and is not cached across runs.
- When `lark.sync_feature_id` is disabled, newly allocated feature IDs remain local only.

## Current state of the code

`lv start` is implemented in `src/cli/start.ts` and registered in `src/index.ts`. The command currently supports ticket-based starts with optional inline feature bootstrap and write-back to Lark, plus description-based starts that create a change without any ticket lookup. For ticket-based runs, the command writes `docs/changes/<ticket-id>/state.yaml`, stages and commits the resulting work, and attempts to push the branch. The persisted state schema in `src/types.ts` records the change identity, title, description, feature IDs, branch, creation time, and CLI version.
