## Why

`lv start` always creates a new change branch from `.lv.yaml`'s single `default_branch`, regardless of the branch type (`--type`/`default_branch_type`) being started. Repos following gitflow-style branching need different feature types to fork from different long-lived branches — e.g. `hotfix` from `master`, `feature` from `develop` — and today there is no way to configure that.

## What Changes

- Extend `branch_types` entries to optionally carry a per-type base branch alongside the existing naming pattern, so each type can specify where its branches should be created from.
- A type with no base branch configured falls back to `default_branch`, so existing `.lv.yaml` files with `branch_types` as a plain `{ typeName: "pattern" }` string map keep working unchanged.
- `lv start` resolves the base branch for the branch type actually being started (`--type`, or `default_branch_type` if omitted) and passes it through to branch creation and to the restart path's branch discard/recreate, instead of always using `default_branch`.

## Capabilities

### New Capabilities
- `lv-start/base-branch-per-type`: `branch_types` entries can configure a per-type base branch that `lv start` creates and recreates (on restart) branches from, falling back to `default_branch` when a type has none configured.

### Modified Capabilities
(none — `resume-or-restart-existing-branch`'s existing requirement already refers generically to "the configured base branch"; that wording remains accurate once the base branch is resolved per type instead of always being `default_branch`.)

## Impact

- `src/types.ts`: `ConfigSchema`'s `branch_types` field changes from `z.record(z.string(), z.string())` to accept either a plain pattern string (back-compat) or an object with `pattern` and an optional `base_branch`.
- `src/engine/branch-naming.ts`: `getBranchTypes()`/pattern lookups need to unwrap the new shape to get at the naming pattern; add a way to resolve a type's base branch (falling back to `default_branch`).
- `src/cli/start.ts`: both `startFromTicket` and `startFromDescription` resolve the base branch for the branch type being started and pass it to `createBranch()` / `discardLocalBranch()` instead of `config.default_branch`.
- `.lv.yaml`, `README.md`, `docs/features/lv-start/*`: document the new per-type `base_branch` option and the string-shorthand back-compat behavior.
