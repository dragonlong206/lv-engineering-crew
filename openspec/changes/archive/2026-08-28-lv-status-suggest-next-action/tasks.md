## 1. Data model

- [x] 1.1 Add `openspec_changes: z.array(z.string()).default([])` to `StateSchema` in `src/types.ts`, and verify `npx tsc --noEmit` passes and an existing `state.yaml` without the field still parses (via `readState()`) to `openspec_changes: []`.
- [x] 1.2 Add `addOpenspecChange(repoRoot, changeId, openspecChangeName)` to `src/engine/state-io.ts`: reads state, appends the name to `openspec_changes` only if not already present, and writes it back via `writeState()`. Verify by calling it twice with the same name against a scratch `state.yaml` and confirming the list has exactly one entry.

## 2. `lv link` command

- [x] 2.1 Add `src/cli/link.ts` exporting `runLink(openspecChangeName: string)`: resolve the current branch via `currentBranch()`, match it via `matchBranch()` (same pattern as `runStatus()` in `src/cli/status.ts`), print an error and exit non-zero if unmatched, otherwise call `addOpenspecChange()`. Verify by running it on a scratch change branch and inspecting the resulting `state.yaml`.
- [x] 2.2 Register `lv link <openspec-change-name>` in `src/index.ts` following the existing lazy-dynamic-import command shape, and verify `lv link --help` and a real invocation both behave as expected.

## 3. OpenSpec CLI integration

- [x] 3.1 Add `src/integrations/openspec/client.ts` with a low-level `openspec(args, cwd)` runner (`execa('openspec', args, { cwd })`), mirroring `src/integrations/git/client.ts`'s `git()` helper.
- [x] 3.2 Add `getChangeStatus(repoRoot, name)` to the same file: runs `openspec status --change <name> --json`, parses stdout, and returns the relevant fields (`isComplete`, `nextSteps`) or throws on failure/non-zero exit. Verify by calling it against an existing `openspec/changes/` directory in this repo and against a nonexistent name (expect a thrown error).
- [x] 3.3 Add `getApplyProgress(repoRoot, name)` to the same file: runs `openspec instructions apply --change <name> --json` and returns `progress` (`{ total, complete, remaining }`) or throws on failure. Verify against an existing complete change in this repo (e.g. `multi-feature-tasks-lark-sync`) and confirm `remaining` is `0`.

## 4. `lv status` next-action reporting

- [x] 4.1 In `src/cli/status.ts`, after `printStateSummary()`, add a step that reads `state.openspec_changes` and, for each name, prints a next-action line using `getChangeStatus()`/`getApplyProgress()`: no names → suggest `/opsx:propose`; `isComplete: false` → print `nextSteps`; `isComplete: true` and `progress.remaining > 0` → suggest `/opsx:apply`; `remaining === 0` → suggest `/opsx:archive`.
- [x] 4.2 Wrap each per-name lookup in a try/catch so a failure (missing `openspec` CLI, archived/removed change, malformed output) prints "OpenSpec status could not be determined for `<name>`" for that entry only and does not throw out of `runStatus()`. Verify by running `lv status` with a tracked name that no longer has an `openspec/changes/` directory and confirming the command still exits `0` and still prints the state summary.
- [x] 4.3 Manually verify the four scenarios end-to-end against this repo's own change (`lv-status-suggest-next-action`, tracked via `lv link` once this command works): no tracked change, planning incomplete, planning complete with unchecked tasks, and all tasks checked off — confirm `lv status`'s suggestion matches each case.

## 5. `lv init` installs the `/opsx:propose` → `lv link` instruction

- [x] 5.1 Add `PROPOSE_LINK_CHANGE_LINE` to `src/prompts.ts`, alongside `PROPOSE_STATE_AUTOLOAD_LINE`: an LV Crew instruction to run `lv link "<name>"` (the name used for `openspec new change`) immediately after that command succeeds, skipped when there is no `docs/changes/<change-id>/state.yaml` matching the current branch.
- [x] 5.2 Add `addProposeLinkInstruction(repoRoot)` to `src/cli/init.ts`, following `addProposeStateAutoload()`'s exact shape: iterate `PROPOSE_WORKFLOW_FILES`, skip missing files, skip files already containing `PROPOSE_LINK_CHANGE_LINE` (whitespace-normalized), find the "This creates a scaffolded change in the planning home resolved by the CLI with `.openspec.yaml`." line and insert the new instruction immediately after it at matching indentation, and log-and-skip (never throw) if that anchor line isn't found. Call it from `runInit()` alongside the existing three patch calls.
- [x] 5.3 Verify by running `lv init` (or the underlying function) against this repo: confirm all three files (`.claude/commands/opsx/propose.md`, `.claude/skills/openspec-propose/SKILL.md`, `.agents/skills/openspec-propose/SKILL.md`) gain the new instruction right after step 3's `openspec new change` block, and that running it a second time leaves the files unchanged (idempotent — no duplicate instruction).
