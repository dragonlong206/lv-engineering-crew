<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

<!-- AUTO-GENERATED — verified from repository code. -->

# lv status

## Architecture and layers

`lv status` is a thin read-and-render CLI command built from existing primitives:

- CLI layer: `src/cli/status.ts` orchestrates execution.
- Config layer: `loadConfig()` and `getRepoRoot()` provide repository context.
- Git layer: `currentBranch(repoRoot)` returns the active branch name.
- Branch parsing layer: `matchBranch(config, branch)` maps a branch name back to a change ID.
- Persistence layer: `readState(repoRoot, changeId)` loads and validates `state.yaml`.
- Presentation layer: `printStateSummary(changeId, state)` renders the change summary.
- OpenSpec integration layer: `getChangeStatus(repoRoot, name)` and `getApplyProgress(repoRoot, name)` drive the next-action hints.

The command does not introduce its own state machine or caching. It is entirely driven by the branch name and the on-disk change state, with a best-effort OpenSpec lookup per recorded change.

## Data model / schema

`readState()` reads `docs/changes/<change-id>/state.yaml` and parses it with `StateSchema` from `src/types.ts`.

The current `State` shape is:

- `ticket_id?: string`
- `title: string`
- `description: string`
- `feature_ids: string[]`
- `branch: string`
- `created_at: string`
- `lv_version: string`
- `openspec_changes: string[]` with a default of `[]`

`lv status` consumes the summary fields plus `openspec_changes`. There are no step records, progress counters, or approval timestamps in the current model.

Branch resolution depends on configuration in `.lv.yaml`:

- `branch_types` maps branch type names to branch templates.
- `default_branch_type` is used by the broader branch-naming system, but `status` itself only needs matching behavior.
- Branch templates use `{ticket_id}` and `{summary}` placeholders.

## APIs / interfaces

### CLI interface

- `lv status`

Behavior:

- Uses the current branch only.
- Fails if the current branch is not recognized as a change branch.
- Prints the loaded state summary to stdout.
- Prints OpenSpec next-action guidance for each entry in `state.openspec_changes`.

### Internal interfaces used

- `runStatus(): Promise<void>` in `src/cli/status.ts`
- `printStateSummary(changeId: string, state: State): void` in `src/cli/status.ts`
- `currentBranch(repoRoot: string)` in `src/integrations/git/client.ts`
- `matchBranch(config, branchName)` in `src/engine/branch-naming.ts`
- `readState(repoRoot: string, changeId: string)` in `src/engine/state-io.ts`
- `StateSchema` / `State` in `src/types.ts`
- `getChangeStatus(repoRoot: string, name)` in `src/integrations/openspec/client.ts`
- `getApplyProgress(repoRoot: string, name)` in `src/integrations/openspec/client.ts`

## Key design decisions

- Status is branch-derived, not argument-driven. The command does not accept a change ID because the active branch is treated as the source of truth for what change is being inspected.
- Matching is centralized in branch-naming helpers, which keeps `status` aligned with the same branch conventions used elsewhere in the CLI.
- Validation happens at read time through `StateSchema`, so malformed `state.yaml` files fail early instead of producing partial output.
- Output is intentionally a human-readable summary of persisted change context, not a workflow dashboard. The code prints stable metadata first, then derives optional OpenSpec next steps as a separate concern.
- Presentation is shared with `lv resume` through `printStateSummary()`, so both commands display the same state summary format.
- OpenSpec lookup failures are isolated per change name so one broken integration result does not prevent the rest of the status output from being shown.
