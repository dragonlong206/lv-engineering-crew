<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv start design

## Architecture and layers

`lv start` is a thin CLI orchestration layer over four main subsystems:

- Configuration and path resolution from `src/config.ts`
- Ticket retrieval from `src/tools/lark.ts`
- Git branch and commit operations from `src/integrations/git/client.ts`
- State persistence from `src/engine/state-io.ts`
- Analysis document generation through `src/agents/analysis-agent.ts` and prompt construction in `src/prompts.ts`

The command flow is intentionally linear. It validates prerequisites first, then performs the side effects in order: branch creation, document generation, state write, commit, and push.

## Data model / schema

The start command consumes a Lark ticket record shaped as:

- `id`
- `title`
- `description`
- `featureIds: string[]`
- `rawFields`

The feature IDs are parsed from the configured Lark field. A string value is split on commas and trimmed. Array values are flattened and string elements are also split on commas.

The persisted ticket state is `StateSchema` from `src/types.ts` and `src/engine/state-io.ts` writes it to `docs/changes/<ticket-id>/state.yaml`. For `lv start`, the stored state includes:

- `ticket_id`
- `feature_ids`
- `branch`
- `current_step: 'analysis'`
- `steps.analysis` with `status`, `iterations`, `model`, `tokens_in`, `tokens_out`, and `duration_seconds`
- `created_at`
- `lv_version`

Analysis output is written to `docs/changes/<ticket-id>/01-analysis.md`.

## APIs / interfaces

The command entry point is `runStart(ticketId: string, opts: { type?: string } = {}): Promise<void>` in `src/cli/start.ts`.

Key supporting interfaces and functions:

- `renderBranchName(config, ticketId, type?)` in `src/engine/branch-naming.ts`
- `getTenantAccessToken(appId, appSecret)` and `fetchTicket(ticketId, baseId, tableId, featureIdField, token)` in `src/tools/lark.ts`
- `createBranch(repoRoot, branchName, fromBranch)` in `src/integrations/git/client.ts`
- `commitAll(repoRoot, message)` and `push(repoRoot, branchName)` in `src/integrations/git/client.ts`
- `writeState(repoRoot, state)` in `src/engine/state-io.ts`
- `buildAnalysisPrompt(ticket, featureDirs, repoRoot)` in `src/prompts.ts`
- `analysisAgent.generate(prompt, { memory, model })`

The branch naming layer uses `branch_types` and `default_branch_type` from config. If the requested type is not present, `renderBranchName()` throws before any external calls.

## Key design decisions

- Validate the branch type up front so the command fails before contacting Lark or Git.
- Require feature docs to exist before starting a ticket, which makes `lv bootstrap` the prerequisite for any ticket that references new features.
- Create the branch before running the analysis agent, so the generated work is immediately anchored on the correct ticket branch.
- Use a single state file as the source of truth for the ticket workflow, with `analysis` initialized as `in_progress`.
- Capture generation metrics in state, including model name, token counts, and duration.
- Commit all repo changes in one shot rather than staging only the generated files.
- Treat push as best effort rather than mandatory, allowing offline or no-remote workflows to continue locally.