<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv start

`lv start` creates the initial change context for either a Lark Base ticket or a free-text description. For ticket-based starts it fetches the ticket from Lark, derives a branch name from the ticket ID and ticket title, ensures feature IDs are present, bootstraps missing feature docs inline when needed, writes `docs/changes/<change-id>/state.yaml`, commits the work, and then tries to push the branch. For description-based starts it skips Lark, derives a short title from the first line of the description, and creates a change context from that text.

## Main components

- `src/index.ts` registers `lv start [ticket-id]` with `--type <type>` and `--description <description>`.
- `src/cli/start.ts` orchestrates both the ticket-based and description-based start flows.
- `src/tools/lark.ts` fetches tickets from Lark Base and can write a newly allocated feature ID back to the ticket.
- `src/engine/branch-naming.ts` renders branch names from config, ticket or change ID, and a summary slug.
- `src/engine/feature-id.ts` allocates new `Fxxxx` feature IDs from the existing `docs/features/` directory.
- `src/cli/bootstrap.ts` exposes `generateFeatureDocsFromScan()`, which generates or refines `overview.md` and `design.md` for a feature directory from a repository scan.
- `src/engine/state-io.ts` writes the workflow state file under `docs/changes/<change-id>/state.yaml`.
- `src/integrations/git/client.ts` creates the branch, stages and commits changes, and pushes to `origin`.
- `src/config.ts` resolves repository paths and loads `.lv.yaml` plus `.lv.local.yaml`.
- `src/types.ts` defines the persisted state and config schema, including `lark.sync_feature_id`.

## High-level flow

1. Load configuration and resolve the repository root.
2. If a ticket ID was provided, require Lark app credentials and exchange them for a tenant access token.
3. Fetch the ticket record from Lark Base using the configured base, table, feature field, and title field.
4. Render the branch name from the configured branch type, the ticket or change ID, and the ticket title or derived summary.
5. For ticket-based starts, if the ticket has no feature IDs, allocate exactly one new feature ID and treat it as local for the rest of the run.
6. For each referenced feature ID whose `docs/features/<id>/` directory does not exist, generate feature docs inline from a repository scan, seeded with the ticket title and description.
7. If any feature docs were generated, print their paths and prompt for confirmation before continuing. Declining stops the command before branch creation or commit.
8. If a new feature ID was allocated and `lark.sync_feature_id` is enabled, attempt to write it back to the Lark ticket. Sync failures are non-fatal.
9. Create the branch from `config.default_branch`.
10. Write `docs/changes/<change-id>/state.yaml` with the change metadata.
11. Stage and commit all repository changes, then attempt to push the branch to `origin`.
12. Print a success message and the path to the created change context.

## Constraints and assumptions

- The command supports two entry modes: `lv start <ticket-id>` and `lv start --description "..."`.
- `--type` must match a configured branch type key, or one of the built-in defaults when `branch_types` is unset.
- Ticket-based starts use the ticket ID as the change ID and the ticket title as the branch summary when available.
- Description-based starts derive a short title from the first line of the description, use an underscore form of that title as the change ID, and do not require Lark access.
- A ticket with no Feature ID is treated as introducing exactly one new feature. If the ticket refers to more than one feature ID, those feature directories must already exist or be generated during the run.
- Inline feature doc generation runs only for missing feature directories and uses the ticket title and description as hints, so the generated docs are still meant for human review before continuing.
- `commitAll()` stages all tracked and untracked changes in the repository, not just the files created by `lv start`.
- Push failures are tolerated. If `git push` fails, the local branch and commit remain in place.
- The Lark access token is fetched per invocation and is not cached across runs.
- When `lark.sync_feature_id` is disabled, newly allocated feature IDs remain local only.

## Current state of the code

`lv start` is implemented in `src/cli/start.ts` and registered in `src/index.ts`. The command supports ticket-based starts with optional inline feature bootstrap and best-effort write-back to Lark, plus description-based starts that create a change without any ticket lookup. For ticket-based runs, the command writes `docs/changes/<ticket-id>/state.yaml`, stages and commits the resulting work, and attempts to push the branch. The persisted state schema in `src/types.ts` records the change identity, title, description, feature IDs, branch, creation time, and CLI version.