<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv start design

## Architecture and layers

`lv start` is a CLI orchestration command that ties together configuration, Lark ticket retrieval, branch naming, document generation, state persistence, and Git side effects.

The main layers are:

- Command registration in `src/index.ts`
- Workflow orchestration in `src/cli/start.ts`
- Configuration and path resolution in `src/config.ts`
- Lark Base access in `src/tools/lark.ts`
- Branch naming in `src/engine/branch-naming.ts`
- Analysis generation and prompt construction in `src/agents/analysis-agent.ts` and `src/prompts.ts`
- State read/write in `src/engine/state-io.ts`
- Git operations in `src/integrations/git/client.ts`

The flow is linear and fail-fast. It validates required configuration and ticket prerequisites before branch creation, then performs the side effects in order: create branch, generate analysis, write state, commit, and push.

## Data model / schema

The command consumes a Lark ticket record shaped as:

- `id`
- `title`
- `description`
- `featureIds: string[]`
- `rawFields`

The Lark ticket data is read from the configured base and table. Feature IDs are extracted from the configured feature field as either a comma-separated string or an array of strings, and empty values are ignored. The title is read from the configured title field, with the ticket ID used as a fallback when the field is empty.

The persisted workflow state is `StateSchema` from `src/types.ts` and `src/engine/state-io.ts` writes it to `docs/changes/<ticket-id>/state.yaml`. For `lv start`, the stored state includes:

- `ticket_id`
- `feature_ids`
- `branch`
- `current_step: 'analysis'`
- `steps.analysis` with `status`, `iterations`, `model`, `tokens_in`, `tokens_out`, and `duration_seconds`
- `created_at`
- `lv_version`

Analysis output is written to `docs/changes/<ticket-id>/1.proposal.md`.

## APIs / interfaces

The command entry point is `runStart(ticketId: string, opts: { type?: string } = {}): Promise<void>` in `src/cli/start.ts`.

Key supporting interfaces and functions are:

- `renderBranchName(config, ticketId, { type?, summary? })` in `src/engine/branch-naming.ts`
- `getTenantAccessToken(appId, appSecret)` and `fetchTicket(ticketId, baseId, tableId, featureIdField, titleField, token)` in `src/tools/lark.ts`
- `createBranch(repoRoot, branchName, fromBranch)` in `src/integrations/git/client.ts`
- `commitAll(repoRoot, message)` and `push(repoRoot, branchName)` in `src/integrations/git/client.ts`
- `writeState(repoRoot, state)` in `src/engine/state-io.ts`
- `buildAnalysisPrompt(ticket, featureDirs, repoRoot)` in `src/prompts.ts`
- `analysisAgent.generate(prompt, { memory, model })`

The branch naming layer uses `branch_types` and `default_branch_type` from config. If the requested type is not present, `renderBranchName()` throws before any external calls.

## Key design decisions

- Validate the branch type only after the ticket is fetched, because the branch name includes the ticket title slug.
- Require feature docs to exist before starting a ticket, which makes `lv bootstrap` the prerequisite for any ticket that references new features.
- Create the branch before running the analysis agent, so generated work is immediately anchored on the correct ticket branch.
- Use a single state file as the source of truth for the ticket workflow, with `analysis` initialized as `in_progress`.
- Capture generation metrics in state, including model name, token counts, and duration.
- Commit all repository changes in one shot rather than staging only the generated files.
- Treat push as best effort rather than mandatory, allowing offline or no-remote workflows to continue locally.