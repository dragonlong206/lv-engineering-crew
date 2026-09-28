## 1. Guidance text

- [x] 1.1 Add `APPLY_TEST_GUIDANCE` to `src/prompts.ts`, next to `ARCHIVE_GUIDANCE`, with a comment in the same style. Its wording is defined by design.md Decision 5: follow the repo's existing test framework and conventions, cover each `#### Scenario:` in the delta specs, run the tests before checking off the related task, and in a repo with no framework, add no new framework and report the uncovered scenarios. Verify with `npx tsc --noEmit`.
- [x] 1.2 Add `TASKS_TEST_RULE` to `src/prompts.ts`. It tells the agent to include test tasks naming the scenarios they cover, and, in a repo with no test framework, manual or scripted verification steps per scenario. Verify with `npx tsc --noEmit`.

## 2. Config writers in `lv init`

- [x] 2.1 Replace `addArchiveGuidance()` in `src/cli/init.ts` with `addOperationGuidance(repoRoot, entries)` (design.md Decision 3). It takes `{ operation, text, legacy? }` entries. When `operations:` is inactive it does one raw append with every entry `JSON.stringify`-quoted; otherwise it does one YAML merge that upgrades a legacy match in place, appends missing entries, and keeps foreign entries. Call it from `runInit()` with the archive entry (`ARCHIVE_GUIDANCE`, legacy `LEGACY_ARCHIVE_GUIDANCE`) and the apply entry (`APPLY_TEST_GUIDANCE`). Verify with `npx tsc --noEmit` and `npm run build`.
- [x] 2.2 Add `addArtifactRules(repoRoot, entries)` to `src/cli/init.ts` (design.md Decision 4). It appends a `rules:` block when that key is inactive, and otherwise merges into `rules.<artifact>` while keeping existing rules. Call it from `runInit()` with `{ tasks: TASKS_TEST_RULE }`. Verify with `npx tsc --noEmit` and `npm run build`.

## 3. Scripted verification against scratch repos (repo has no test suite, per spec scenarios)

- [x] 3.1 Scenarios "Applying a change in a repo with an existing test suite", "…with no automated test suite", "…with no delta specs": in a fresh scratch git repo with `.lv.yaml`, run `lv init --tool claude`. Then run `openspec new change demo` and `openspec instructions apply --change demo --json`. Confirm that `operationGuidance` contains `APPLY_TEST_GUIDANCE`, including its no-framework and no-scenarios wording.
- [x] 3.2 Scenarios "Generating tasks for a change with delta spec scenarios", "Generating tasks in a repo with no automated test suite": in the same scratch repo, run `openspec instructions tasks --change demo --json`. Confirm that `rules` contains `TASKS_TEST_RULE`.
- [x] 3.3 Fresh-install comment preservation (design.md Decision 3): diff the scratch repo's `openspec/config.yaml` against OpenSpec's untouched template. Confirm the template comments are still present, and that exactly one `operations:` block holds both `archive` and `apply`.
- [x] 3.4 Scenario "Configuring step runs more than once": re-run `lv init --tool claude` in the scratch repo. Confirm `openspec/config.yaml` is byte-identical afterwards.
- [x] 3.5 Scenario "Engineer already has custom apply guidance or tasks rules": in a second scratch repo, pre-seed `operations.apply.guidance` and `rules.tasks` with custom strings, then run `lv init`. Confirm both custom entries survive and each LV entry appears exactly once.
- [x] 3.6 Scenario "Archive guidance is already configured", plus an archive regression check: in a third scratch repo, pre-seed `operations.archive.guidance` with `LEGACY_ARCHIVE_GUIDANCE`, then run `lv init`. Confirm the entry is upgraded to `ARCHIVE_GUIDANCE` with no duplicate, and that `openspec instructions archive --change demo --json` still returns it.
- [x] 3.7 Scenario "Apply completes without the recommended tests": confirm by inspection that nothing LV installs checks for tests. The only artifacts are config text entries; no hook, script, or validation was added.

## 4. Dogfood and docs

- [x] 4.1 Re-run `npm run dev -- init --tool claude` in this repo. Confirm with `git diff openspec/config.yaml` that only `operations.apply` and `rules.tasks` were added and that the existing `context:` and archive guidance are unchanged.
- [x] 4.2 Update the `lv init` paragraph in `CLAUDE.md` to mention the `operations.apply.guidance` and `rules.tasks` writes alongside the archive guidance. Verify by reading the diff.
