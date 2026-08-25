<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv start

Starts a ticket workflow from a Lark Base record. It verifies that the ticket has at least one configured feature ID, checks that each referenced feature directory already exists, creates a Git branch for the ticket, generates `01-analysis.md`, writes `state.yaml`, commits the result, and then pushes the branch when possible.

## Main components

- `src/cli/start.ts` - orchestrates the full start flow
- `src/tools/lark.ts` - exchanges Lark app credentials for a tenant token and fetches the ticket record
- `src/engine/branch-naming.ts` - renders the branch name from config and validates `--type`
- `src/agents/analysis-agent.ts` - generates the initial analysis document
- `src/prompts.ts` - builds the analysis prompt passed to the agent
- `src/engine/state-io.ts` - writes the ticket state file
- `src/integrations/git/client.ts` - creates the branch, commits, and pushes
- `src/config.ts` and `src/types.ts` - supply config, paths, and state schema

## High-level flow

1. Load config and resolve the repo root.
2. Render the branch name from the ticket ID and optional `--type`, failing immediately if the type is unknown.
3. Require `lark_app_id` and `lark_app_secret`, then exchange them for a short-lived Lark tenant access token.
4. Fetch the ticket record from Lark Base using `base_id`, `table_id`, and `feature_id_field`.
5. Require at least one feature ID on the ticket.
6. Confirm that every referenced feature directory already exists under the repo.
7. Create a branch from `config.default_branch`.
8. Build the analysis prompt from the ticket and feature docs, run the analysis agent, and write `docs/changes/<ticket-id>/01-analysis.md`.
9. Write `docs/changes/<ticket-id>/state.yaml` with analysis step metadata and `current_step: analysis`.
10. Stage and commit all changes, then try to push the branch to `origin`.

## Constraints and assumptions

- `--type` must match a key in `branch_types`, or the built-in default branch type map if `branch_types` is unset.
- The ticket must contain at least one feature ID in the configured Lark field, which defaults to `Feature ID`.
- Every referenced feature must already have a docs directory in the repository, or the command exits and points to `lv bootstrap`.
- The branch is created from `config.default_branch`, which defaults to `main`.
- Push failures are tolerated. If `git push` fails, the branch and commit remain local.
- The Lark access token is fetched per invocation, not cached across runs.
- `commitAll()` stages all tracked and untracked changes in the repository, not just the ticket files.

## Current state of the code

`lv start` is implemented in `src/cli/start.ts` and is wired to the Lark, Git, state, and analysis subsystems described above. The command currently writes a single analysis document, initializes state in `state.yaml`, commits the work, and attempts a push. The state schema in `src/types.ts` records the ticket ID, feature IDs, branch, current step, per-step metrics, creation time, and CLI version.