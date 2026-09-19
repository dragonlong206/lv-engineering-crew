## 1. Config schema

- [x] 1.1 Add `OpenSpecConfigSchema` (`{ apply_model?: string }`) and an optional `openspec` field on `ConfigSchema` in `src/types.ts`; verify `npx tsc --noEmit` passes and `Config["openspec"]?.apply_model` types as `string | undefined`
- [x] 1.2 Document the new `openspec.apply_model` key in `.lv.yaml`'s comments (next to the existing `models:` block), explaining it's a Claude Code model alias/id for the generated `/opsx:apply` command, distinct from `models:`'s Mastra provider/model strings; verify by reading the updated file

## 2. Frontmatter patch function

- [x] 2.1 In `src/cli/init.ts`, add a function (e.g. `setApplyModelOverride(repoRoot, config)`) that reads `.claude/commands/opsx/apply.md`, no-ops if the file doesn't exist, and otherwise parses its leading `---`-delimited frontmatter block with `js-yaml`, sets `model` to `config.openspec?.apply_model` when it's a non-empty string or deletes the `model` key otherwise, re-dumps only that block, and leaves the rest of the file untouched; verify with a scratch copy of the file for each case (add, update-existing-value, remove, no-op-when-already-absent)
- [x] 2.2 If the file doesn't start with a `---` frontmatter block (unexpected upstream shape), log the same "file may have changed shape upstream" warning style as `addProposeStateAutoload()` and skip without throwing; verify by running against a mangled copy of the file
- [x] 2.3 Call `loadConfig()` once in `runInit()` (it doesn't load config today) and pass the result to `setApplyModelOverride(repoRoot, config)`, invoked alongside the existing `addPropose*`/`addContextPointer`/`addArchiveGuidance` calls; verify by running `lv init` against a scratch repo with `openspec.apply_model` set and confirming `.claude/commands/opsx/apply.md`'s frontmatter gains `model: <value>`

## 3. Idempotency and clearing

- [x] 3.1 Verify running `lv init` twice in a row with the same `apply_model` value leaves exactly one `model` field with that value (no duplicate key, no reformatting churn beyond the `model` line)
- [x] 3.2 Verify unsetting `apply_model` in `.lv.yaml` and re-running `lv init` removes the previously-added `model` field from `.claude/commands/opsx/apply.md`'s frontmatter
- [x] 3.3 Verify `lv init` still succeeds end-to-end (no `model` field added or removed) in a scratch repo with no `openspec.apply_model` configured at all

## 4. Docs

- [x] 4.1 Refresh `docs/features/lv-init/{overview.md,design.md}` via the `lv-bootstrap` skill/command to describe the new apply-model patch step, per this repo's own archive guidance
