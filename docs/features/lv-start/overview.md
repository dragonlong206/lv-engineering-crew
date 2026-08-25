<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv start

Starts a ticket workflow from a Lark Base record. It fetches the ticket, renders a ticket branch name, verifies that the ticket references at least one feature, checks that each referenced feature already has docs under `docs/features/`, creates the Git branch, generates the initial analysis document, writes workflow state, commits the result, and then attempts to push the branch.

## Main components

- `src/index.ts` registers the `lv start <ticket-id>` command and the `--type <type>` option.
- `src/cli/start.ts` orchestrates the start flow.
- `src/tools/lark.ts` exchanges Lark app credentials for a tenant token and fetches the ticket record.
- `src/engine/branch-naming.ts` renders the branch name from config, ticket ID, and ticket title.
- `src/agents/analysis-agent.ts` generates the initial analysis document.
- `src/prompts.ts` builds the analysis prompt.
- `src/engine/state-io.ts` writes the ticket state file.
- `src/integrations/git/client.ts` creates the branch, commits, and pushes.
- `src/config.ts` resolves the repo root, config, and feature paths.
- `src/types.ts` defines the persisted state schema and version.

## High-level flow

1. Load configuration and resolve the repository root.
2. Require `lark_app_id` and `lark_app_secret`.
3. Exchange the Lark app credentials for a tenant access token.
4. Fetch the ticket record from Lark Base using the configured base, table, feature field, and title field.
5. Render the branch name from the ticket ID, optional `--type`, and ticket title.
6. Require at least one feature ID on the ticket.
7. Confirm that every referenced feature directory already exists under `docs/features/`.
8. Create a branch from `config.default_branch`.
9. Build the analysis prompt from the ticket and feature docs, run the analysis agent, and write `docs/changes/<ticket-id>/1.proposal.md`.
10. Write `docs/changes/<ticket-id>/state.yaml` with analysis step metadata and `current_step: analysis`.
11. Stage and commit all repository changes, then attempt to push the branch to `origin`.
12. Finish with a success message and the path to the generated analysis file.

## Constraints and assumptions

- `--type` must match a key in `branch_types`, or the built-in default branch type map if `branch_types` is unset.
- The branch name includes a slugified ticket title when the title field is present; if the configured title field is empty, the ticket ID is used instead.
- The ticket must contain at least one feature ID in the configured Lark field, which defaults to `Feature ID`.
- Every referenced feature must already have a docs directory in the repository, or the command exits and points to `lv bootstrap`.
- The branch is created from `config.default_branch`, which defaults to `main`.
- Push failures are tolerated. If `git push` fails, the branch and commit remain local.
- The Lark access token is fetched per invocation, not cached across runs.
- `commitAll()` stages all tracked and untracked changes in the repository, not just the ticket files.
- The generated analysis file is `docs/changes/<ticket-id>/1.proposal.md`, not `01-analysis.md`.

## Current state of the code

`lv start` is implemented in `src/cli/start.ts` and is wired to the Lark, Git, state, and analysis subsystems described above. The command currently writes a single analysis document, initializes state in `state.yaml`, commits the work, and attempts a push. The persisted state schema in `src/types.ts` records the ticket ID, feature IDs, branch, current step, per-step metrics, creation time, and CLI version.