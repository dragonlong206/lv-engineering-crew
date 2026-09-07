## 1. Config schema

- [x] 1.1 In `src/types.ts`, change `ConfigSchema.branch_types` from `z.record(z.string(), z.string())` to `z.record(z.string(), z.union([z.string(), z.object({ pattern: z.string(), base_branch: z.string().optional() })]))`, and verify `npx tsc --noEmit` passes with the updated `Config` type.
- [x] 1.2 Update `.lv.yaml`'s commented `branch_types` example to show both the plain-string shorthand and the object form with `base_branch`, and verify the file still parses (`lv status` or any command that calls `loadConfig()` runs without error).

## 2. Branch naming / resolution

- [x] 2.1 In `src/engine/branch-naming.ts`, update `getBranchTypes()` to unwrap each `branch_types` entry to its pattern string (returning the entry itself if it's a plain string, or its `.pattern` if it's an object), keeping its return type `Record<string, string>` so `renderBranchName`, `matchBranch`, and `branchGlobs` need no changes.
- [x] 2.2 Add `resolveBaseBranch(config: Config, type: string): string` to `src/engine/branch-naming.ts` that reads `config.branch_types?.[type]`, returns its `base_branch` when the entry is an object with one set, and falls back to `config.default_branch` otherwise (including when the type is unconfigured, uses `DEFAULT_BRANCH_TYPES`, or is a plain string).
- [x] 2.3 Add unit-style manual verification (via `npm run dev -- start --description "..."` against a scratch repo, or a small throwaway script) confirming: a type with `base_branch` set resolves to it; a type with a plain-string pattern resolves to `default_branch`; an unconfigured type resolves to `default_branch`.

## 3. Wire `lv start` to the resolved base branch

- [x] 3.1 In `src/cli/start.ts`, factor out `const branchType = opts.type ?? config.default_branch_type` and `const baseBranch = resolveBaseBranch(config, branchType)` near the top of both `startFromTicket` and `startFromDescription`, before the `resolveExistingBranch()` call.
- [x] 3.2 Change `resolveExistingBranch()`'s signature to accept `baseBranch: string` (replacing its internal use of `config.default_branch`) and pass it through to its `discardLocalBranch(repoRoot, branchName, baseBranch)` call; update both call sites to pass the `baseBranch` computed in 3.1.
- [x] 3.3 Replace the `createBranch(repoRoot, branchName, config.default_branch)` calls in both `startFromTicket` and `startFromDescription` with `createBranch(repoRoot, branchName, baseBranch)`.
- [x] 3.4 Verify end-to-end in a scratch git repo with two long-lived branches (e.g. `master` and `develop`): configure `.lv.yaml` with `branch_types: { feature: { pattern: "feature/{ticket_id}-{summary}", base_branch: "develop" }, hotfix: { pattern: "hotfix/{ticket_id}-{summary}", base_branch: "master" } }`, run `lv start --description "..." --type hotfix` and confirm the created branch forks from `master`'s tip (not `develop`'s), then repeat with `--type feature` and confirm it forks from `develop`.
- [x] 3.5 Verify the restart path picks up the same resolved base branch: start a change, restart it (or manually recreate the existing-branch/restart prompt scenario), and confirm the recreated branch forks from the type's configured `base_branch`, not `default_branch`.
- [x] 3.6 Verify backward compatibility: with `branch_types` left as a plain string map (no `base_branch` anywhere), run `lv start` and confirm the branch is still created from `default_branch`, matching current behavior.

## 4. Documentation

- [x] 4.1 Update `README.md`'s `branch_types` example and surrounding prose to document the optional object form and `base_branch`.
- [x] 4.2 Update `docs/features/lv-start/design.md`'s Configuration and Key design decisions sections to mention per-type `base_branch` resolution and `resolveBaseBranch()`.
- [x] 4.3 Update `CLAUDE.md`'s "Branch naming is configurable" paragraph to describe the `string | { pattern, base_branch? }` shape and `resolveBaseBranch()`.
