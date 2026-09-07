## Context

See proposal.md - Why. Today `default_branch` is the only base branch `lv start` ever checks out from (`createBranch(repoRoot, branchName, config.default_branch)` in both `startFromTicket` and `startFromDescription`, and `discardLocalBranch(repoRoot, branchName, config.default_branch)` on restart in `resolveExistingBranch`). `branch_types` (`.lv.yaml`) is a flat `Record<string, string>` of type name → naming pattern, consumed only inside `src/engine/branch-naming.ts` (`getBranchTypes()`, used by `renderBranchName`, `matchBranch`, `branchGlobs`) — no other module reads `config.branch_types` directly.

## Goals / Non-Goals

**Goals:**
- Let `.lv.yaml` configure a base branch per entry in `branch_types`.
- Keep every existing `.lv.yaml` with `branch_types` as a plain string map working with no changes and no behavior difference.
- Resolve the base branch once per `lv start` invocation, from the same branch type used to render the branch name, so creation and restart-recreation always agree.

**Non-Goals:**
- No change to how the naming pattern itself is resolved, parsed, or matched (`renderBranchName`, `matchBranch`, `branchGlobs`, `patternToRegex` keep working on patterns exactly as today).
- No validation that a configured `base_branch` actually exists — `createBranch`/`discardLocalBranch` already surface a git error if it doesn't, same as an invalid `default_branch` would today.
- No per-type override outside `lv start` (e.g. `lv resume` never creates or discards a branch, so it has no base branch to resolve).

## Decisions

**`branch_types` entries become `string | { pattern: string; base_branch?: string }`.**
A `zod` union keeps a plain string entry valid without any migration, and colocates a type's naming pattern with its base branch instead of introducing a second parallel map (e.g. a separate `branch_base_branches` map) that could drift out of sync with `branch_types`'s own keys. Alternative considered: a second top-level map keyed by type name — rejected because it splits one logical concept (how does type X behave?) across two config keys that must be kept consistent by hand.

**`getBranchTypes()` keeps returning `Record<string, string>` (patterns only).**
`renderBranchName`, `matchBranch`, and `branchGlobs` only ever need the pattern, never the base branch — unwrapping the new shape once inside `getBranchTypes()` means none of those three functions (or their regex-building helpers) need to change. A new `resolveBaseBranch(config, type): string` reads `config.branch_types?.[type]` directly, returning its `base_branch` if the entry is an object and has one, else `config.default_branch`.

**The base branch is resolved from the type being started, once, before the existing-branch check.**
`startFromTicket`/`startFromDescription` already compute `branchType = opts.type ?? config.default_branch_type` implicitly inside `renderBranchName`; this change makes that resolution explicit and shared, computing `baseBranch = resolveBaseBranch(config, branchType)` up front and threading it into both `resolveExistingBranch()` (for the restart path's `discardLocalBranch`) and the later `createBranch()` call. This guarantees a restarted branch is recreated from the same base branch a fresh start of that type would use, even though `resolveExistingBranch()` runs before the ticket is fetched (ticket-based start) or before feature matching (description-based start).

## Risks / Trade-offs

- [A change with an in-flight branch created under the old always-`default_branch` behavior, then restarted after this change ships with a different `base_branch` configured for its type] → Not a regression: restart already fully discards and recreates the branch from scratch (per `resume-or-restart-existing-branch`'s existing spec), so it picking up the newly-configured base branch is the intended, documented behavior of restart, not new risk.
- [Silent misconfiguration: a typo'd `base_branch` that doesn't exist locally or on `origin`] → `createBranch`/`discardLocalBranch` call `git checkout <fromBranch>` first, which already fails loudly with git's own error; no new error handling needed.

## Migration Plan

No migration required — this is additive and backward compatible. Existing `.lv.yaml` files with `branch_types` as `{ typeName: "pattern" }` continue to resolve every type's base branch to `default_branch`, unchanged. Repos that want per-type base branches opt in by rewriting the relevant entries to the object form.
