## Context

`startFromTicket()` in `src/cli/start.ts` analyzes complexity, and on a confirmed split calls `source.createSubtickets()` then returns without touching git. Sub-tickets carry the parent link (`ticket.parentId`), and a later `lv start <sub-id>` already fetches the parent (`mergeParentContext`). Branch creation is `createBranch(repoRoot, name, fromBranch)` (checkout base, `pull --ff-only`, `checkout -b`), and `findChangeBranches()` finds branches for a change ID across all configured types, local and `origin/`. `lv` itself never opens PRs; the `commit-push-pr` skill does, so the PR target must be discoverable from `state.yaml`.

## Goals / Non-Goals

**Goals:**
- Opt-in per split, no new config; default behavior unchanged.
- Sub-task discovers the big-feature branch with no extra user input and no new storage beyond `state.yaml`.

**Non-Goals:**
- Merging sub-task PRs, or opening the final big-feature → main PR.
- Nested big features (only the direct parent is considered, consistent with parent-context inheritance).
- Description-based starts (they never split).

## Decisions

1. **Prompt placement:** a new `confirmBigFeatureFlow()` in `helpers.ts`, asked right after `confirmTaskSplit()` returns true. Alternative: fold into one multi-choice prompt; rejected to keep `confirmTaskSplit` semantics (and its spec) intact.
2. **Order of operations:** create sub-tickets first, then the parent branch. If zero sub-tickets were created, skip the branch (nothing would use it). Alternative (branch first) risks orphan branches when Lark writes fail.
3. **Parent branch contents:** `state.yaml` for the parent ticket with `big_feature: true`, `feature_ids: []`, plus title/description; committed with `commitAll` and pushed with the existing `push()` (non-fatal, warn). Reuses `renderBranchName(config, ticketId, {type, summary})` and `resolveBaseBranch`, so gitflow configs work (a big feature forks from `develop`).
4. **Marker in `state.yaml` (`big_feature`) instead of a separate registry or naming convention:** the branch name is user-configurable, and the marker keeps `state.yaml` the single source of truth. Detection: `findChangeBranches(parent.id)`, then read `docs/changes/<parent.id>/state.yaml` at each candidate ref via new `readFileAtRef()` (`git show <ref>:<path>`, trying local then `origin/`), selecting the first with `big_feature: true`. Alternative: look up by sub-task→parent mapping in Lark; rejected (more API surface, not git-native).
5. **Sub-task base:** the detected branch overrides `baseBranch` only for `createBranch()`; `resolveExistingBranch` has already run with the type base, which is harmless (it only uses it to leave a branch before deleting). `state.yaml` records `base_branch`.
6. **PR target:** `lv` prints the target in `printNextSteps()` and `printStateSummary()` shows `base_branch`; the `commit-push-pr` skill is instructed to prefer `base_branch` from `state.yaml` over `main`.

## Risks / Trade-offs

- [Parent branch unpushed → sub-task cannot fork from `origin/` on other machines] → push failure warned; detection also uses the local branch.
- [Parent fetch fails during sub-task start → silently falls back to base branch] → warn explicitly when parent fetch failed that big-feature detection was skipped (existing warning text extended).
- [`createBranch` pull on a branch with no upstream] → `pull --ff-only` already swallows errors.
- [Stale `big_feature` branch left after parent merged] → engineer can start sub-tasks normally only by deleting/unmarking it; accepted for now.

## Migration Plan

Additive optional `state.yaml` fields (zod `.optional()`); existing files remain valid. No rollback needed beyond reverting the release.
