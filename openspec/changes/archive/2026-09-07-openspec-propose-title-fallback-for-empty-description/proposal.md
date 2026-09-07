## Why

The LV-specific `/opsx:propose` patch currently tells the workflow to use the matching `docs/changes/<change-id>/state.yaml` file only when that file has a usable `description`. On ticket-backed changes like `docs/changes/recvusbDWII4py/state.yaml`, the `title` can still clearly describe the work even when `description` is empty, but the current instruction does not permit falling back to it. That forces the workflow to ask the engineer for input even though the branch already carries enough context to proceed, which is exactly the bug this ticket is reporting.

## What Changes

- Narrow the propose-workflow autoload contract so that, when the current branch matches an LV `state.yaml`, the workflow derives the change name from `title` and uses `description` when present, otherwise falling back to `title` as the change description.
- Update the LV-owned prompt source in `src/prompts.ts` so future `lv init` runs install the fallback wording into generated `/opsx:propose` workflow files.
- Refresh the generated propose workflow files this repo already tracks for Codex and Claude so the checked-in instructions match the new source wording instead of keeping the stale behavior.
- Keep the fallback scoped to the propose workflow's step-1 state autoload behavior only; no `state.yaml` schema, ticket ingestion, or non-propose OpenSpec workflow behavior changes.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `lv-init/openspec-bootstrap`: refine the installed propose-workflow autoload requirement so empty `state.yaml.description` falls back to `state.yaml.title` instead of forcing a clarification prompt.

## Impact

- `src/prompts.ts`: `PROPOSE_STATE_AUTOLOAD_LINE` wording changes to define the title fallback explicitly.
- `src/cli/init.ts`: existing propose patch logic should continue to insert the autoload line idempotently after the wording update, and implementation will likely need to ensure already-patched files can be refreshed to the new text cleanly.
- Generated workflow files such as [`.agents/skills/openspec-propose/SKILL.md`](/Users/longle/Documents/git/lv-engineer-crew/.agents/skills/openspec-propose/SKILL.md:1) and [`.claude/commands/opsx/propose.md`](/Users/longle/Documents/git/lv-engineer-crew/.claude/commands/opsx/propose.md:1) are affected because they currently embed the older no-fallback instruction.
- No breaking changes: this only broadens when existing branch context is considered usable.
