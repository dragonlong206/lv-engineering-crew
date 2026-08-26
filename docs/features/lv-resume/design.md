<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

<!-- AUTO-GENERATED — verified against the current codebase. -->

# lv resume

## Architecture and layers

`lv resume` is a thin CLI orchestrator built on existing branch, git, and state helpers.

- CLI layer: `src/index.ts` exposes the command, and `src/cli/resume.ts` coordinates the whole flow.
- Branch layer: `src/engine/branch-naming.ts` interprets configured branch patterns, extracts ticket IDs, and renders fallback branch names.
- Git layer: `src/integrations/git/client.ts` lists candidate branches, detects the current branch, and checks out the resolved branch.
- State layer: `src/engine/state-io.ts` loads the persisted change state from disk.
- Presentation layer: `src/cli/status.ts` supplies `printStateSummary()` so `resume` can reuse the same output format as `status`.
- Interaction layer: `src/cli/helpers.ts` provides prompt-based selection when branch resolution is ambiguous.

## Data model / schema

The command reads the persisted change state from `docs/changes/<change-id>/state.yaml`.

The state schema, as defined in `src/types.ts`, contains:

- `ticket_id` as an optional string
- `title` as a string
- `description` as a string
- `feature_ids` as a string array
- `branch` as a string
- `created_at` as a string
- `lv_version` as a string

`lv resume` does not inspect step-by-step workflow records. It only parses the whole change state and prints it through `printStateSummary()`.

Branch naming is driven by configuration:

- `.lv.yaml` may define `branch_types` as a map from type name to pattern.
- `.lv.yaml` may define `default_branch_type`, which is used when rendering a fallback branch name.
- If `branch_types` is omitted, the built-in defaults from `src/engine/branch-naming.ts` are used.
- Branch patterns use `{ticket_id}` and `{summary}` placeholders.

## APIs / interfaces

### CLI interface

- `lv resume [ticket-id]`

Behavior:

- No argument: resume the current change if the current branch matches a configured change branch.
- No argument on a non-change branch: prompt the user to choose from all matching change branches.
- With a ticket ID: search all configured branch types for branches whose parsed ticket ID matches the argument.

### Internal functions used

- `runResume(ticketId?: string): Promise<void>` in `src/cli/resume.ts`
- `matchBranch(config, branchName)` in `src/engine/branch-naming.ts`
- `branchGlobs(config)` in `src/engine/branch-naming.ts`
- `renderBranchName(config, ticketId)` in `src/engine/branch-naming.ts`
- `currentBranch(repoRoot)` in `src/integrations/git/client.ts`
- `listBranchesMatching(repoRoot, globs)` in `src/integrations/git/client.ts`
- `checkoutBranch(repoRoot, branchName)` in `src/integrations/git/client.ts`
- `readState(repoRoot, changeId)` in `src/engine/state-io.ts`
- `printStateSummary(changeId, state)` in `src/cli/status.ts`

## Key design decisions

- Resume is branch-first, not state-first. It resolves a change branch before loading any state.
- Matching is ticket-ID centric. Summary text in a branch name is ignored for selection.
- The command is forgiving when a requested branch is not local. It will fetch and track from `origin` if possible.
- Ambiguity is handled interactively rather than by guessing, which keeps the command safe when multiple branch types point at the same ticket.
- The fallback branch name is derived from the configured default branch type, using only the ticket ID because no title is available at resume time.
- Output reuse is intentional: `resume` prints the same state summary format as `status` instead of maintaining a second presentation path.