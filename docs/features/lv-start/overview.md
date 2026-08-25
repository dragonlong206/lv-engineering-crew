<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv start

Starts a ticket workflow from a Lark Base record. It fetches the ticket, renders a ticket branch name, resolves the ticket's feature(s) — allocating a new feature ID and generating that feature's docs inline when the ticket introduces a brand-new feature, behind a human review gate — creates the Git branch, generates the initial analysis document, writes workflow state, commits the result, and then attempts to push the branch.

## Main components

- `src/index.ts` registers the `lv start <ticket-id>` command and the `--type <type>` option.
- `src/cli/start.ts` orchestrates the start flow.
- `src/tools/lark.ts` exchanges Lark app credentials for a tenant token, fetches the ticket record, and (new) writes an allocated feature ID back to the ticket's Feature ID field.
- `src/engine/branch-naming.ts` renders the branch name from config, ticket ID, and ticket title.
- `src/engine/feature-id.ts` allocates the next `Fxxxx` feature ID when a ticket has none.
- `src/cli/bootstrap.ts` exposes `generateFeatureDocsFromScan()`, the autonomous-scan doc generator shared with `lv bootstrap`, used here to generate a new feature's docs inline.
- `src/agents/analysis-agent.ts` generates the initial analysis document.
- `src/prompts.ts` builds the analysis prompt.
- `src/engine/state-io.ts` writes the ticket state file.
- `src/integrations/git/client.ts` creates the branch, commits, and pushes.
- `src/config.ts` resolves the repo root, config, and feature paths.
- `src/types.ts` defines the persisted state schema, version, and the `lark.sync_feature_id` config flag.

## High-level flow

1. Load configuration and resolve the repository root.
2. Require `lark_app_id` and `lark_app_secret`.
3. Exchange the Lark app credentials for a tenant access token.
4. Fetch the ticket record from Lark Base using the configured base, table, feature field, and title field.
5. Render the branch name from the ticket ID, optional `--type`, and ticket title.
6. If the ticket has no Feature ID set, allocate one new feature ID via `allocateFeatureIds()` (a ticket with no Feature ID is treated as introducing exactly one new feature).
7. For every feature ID that has no `docs/features/<id>/` directory yet, generate its docs via `generateFeatureDocsFromScan()`, seeded with the ticket's title and description as the hint.
8. If any docs were generated in step 7, print their file paths and prompt for confirmation (default: decline) before continuing. Declining stops the command here — no branch or commit — leaving the generated docs uncommitted on disk for manual review.
9. If a new feature ID was allocated in step 6, sync it back to the ticket's Feature ID field in Lark when `lark.sync_feature_id` is true (default), via `updateTicketFeatureId()`. A sync failure is logged as a non-fatal warning; the command continues either way.
10. Create a branch from `config.default_branch`.
11. Build the analysis prompt from the ticket and feature docs, run the analysis agent, and write `docs/changes/<ticket-id>/1.proposal.md`.
12. Write `docs/changes/<ticket-id>/state.yaml` with analysis step metadata, `current_step: analysis`, and the resolved feature ID list (including any newly allocated ID).
13. Stage and commit all repository changes — including any newly generated and reviewed feature docs — then attempt to push the branch to `origin`.
14. Finish with a success message and the path to the generated analysis file.

## Constraints and assumptions

- `--type` must match a key in `branch_types`, or the built-in default branch type map if `branch_types` is unset.
- The branch name includes a slugified ticket title when the title field is present; if the configured title field is empty, the ticket ID is used instead.
- A ticket with an empty Feature ID field is assumed to introduce exactly one new feature; a ticket needing more than one brand-new feature must pre-allocate via `lv init`/`lv bootstrap` and list the resulting IDs in Lark explicitly.
- Feature docs generated inline (no existing code to scan, since the feature is new) are seeded only from the ticket's title/description — the confirmation gate exists specifically because that context is thin.
- Declining the confirmation gate leaves the generated feature docs on disk, uncommitted; a later `lv start` for the same ticket skips regeneration once the directory exists and proceeds straight past this step.
- The `lark.sync_feature_id` write-back requires the configured Lark app's tenant token to carry Bitable write scope; without it, sync fails but does not block the command.
- The write-back appends to, and preserves the type of (string vs array), whatever the Feature ID field already contains — it never overwrites existing feature IDs.
- The branch is created from `config.default_branch`, which defaults to `main`.
- Push failures are tolerated. If `git push` fails, the branch and commit remain local.
- The Lark access token is fetched per invocation, not cached across runs.
- `commitAll()` stages all tracked and untracked changes in the repository, not just the ticket files — this now includes any newly confirmed feature docs.
- The generated analysis file is `docs/changes/<ticket-id>/1.proposal.md`, not `01-analysis.md`.

## Current state of the code

`lv start` is implemented in `src/cli/start.ts` and is wired to the Lark, Git, state, analysis, and (for brand-new features) bootstrap subsystems described above. The command writes a single analysis document, initializes state in `state.yaml` (including any newly allocated feature ID), commits the work, and attempts a push. The persisted state schema in `src/types.ts` records the ticket ID, feature IDs, branch, current step, per-step metrics, creation time, and CLI version.