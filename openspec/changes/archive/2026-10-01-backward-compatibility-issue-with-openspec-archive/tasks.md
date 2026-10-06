## 1. Entry recovery helper

- [x] 1.1 Add `coerceGuidanceEntry()` (or similarly named) in `src/cli/init.ts` per design.md D1. It returns strings unchanged, rebuilds a one-key mapping with a scalar value as `"<key>: <value>"` flagged `repaired`, and leaves anything else untouched. Verify by running `npx tsc --noEmit`.

## 2. Operation guidance merge

- [x] 2.1 In `addOperationGuidance()`'s YAML-merge branch, coerce every existing guidance entry before matching, and mark the config `changed` when any entry was repaired. Verify that `npx tsc --noEmit` passes.
- [x] 2.2 Reorder the match logic per design.md D2: (1) if the current text is present, remove all legacy matches; (2) otherwise replace the first legacy match in place and drop any extra legacy copies; (3) otherwise append. Verify that `npx tsc --noEmit` passes.
- [x] 2.3 Import `printWarn` and emit one warning naming `openspec/config.yaml` and each repaired list (e.g. `operations.archive.guidance`) when a repair happened (design.md D3). Verify the line appears in the scripted runs in section 4.

## 3. Artifact rules merge

- [x] 3.1 Apply the same coercion and repair warning in `addArtifactRules()`'s merge branch (design.md D4). Verify that `npx tsc --noEmit` passes and that a rules list with an unquoted `"foo: bar"` item comes back as a single string `"foo: bar"` in the scripted check below.

## 4. Scripted verification per scenario (no automated test framework in this repo)

Each check runs the real `lv init` code path against a scratch repo whose `openspec/config.yaml` is seeded with the given `operations.archive.guidance`. Set it up with `git init` and an `.lv.yaml` in a scratchpad directory, then run `npm run dev -- init --tool claude` from it. Afterwards, inspect the file with `node -e` + js-yaml and run `openspec instructions archive --change <scratch-change> --json`.

- [x] 4.1 Scenario "Only a malformed legacy item is present": seed one unquoted `- <LEGACY_ARCHIVE_GUIDANCE>` item. Verify `guidance` ends as exactly `[ARCHIVE_GUIDANCE]` (all strings) and no legacy text remains.
- [x] 4.2 Scenario "Malformed legacy item alongside the current wording": seed the ticket's exact shape (the unquoted legacy item followed by a `- >-` item with current wording). Verify `guidance` ends as exactly one string equal to `ARCHIVE_GUIDANCE`.
- [x] 4.3 Scenario "Repaired guidance is accepted by OpenSpec": after 4.1 and 4.2, run `openspec instructions archive --change <scratch-change> --json`. Verify that `operationGuidance` contains the current wording and that stderr/stdout carries no guidance-invalid warning. Then re-run `lv init` and verify the file is byte-identical, which shows idempotency.
- [x] 4.4 Scenario "Malformed item that is not LV's wording": seed an unquoted `- Note: always run the linter` item. Verify `guidance` ends as `["Note: always run the linter", ARCHIVE_GUIDANCE]`, both strings.
- [x] 4.5 Scenario "Engineer is told about the repair": in runs 4.1, 4.2 and 4.4, verify the `printWarn` repair line is printed.
- [x] 4.6 Scenario "Nothing malformed": seed only a valid quoted current-wording item. Verify that no repair warning is printed and the file is left unchanged.

## 5. Build & docs

- [x] 5.1 Run `npx tsc --noEmit` and `npm run build` and verify both succeed.
- [x] 5.2 Update the `CLAUDE.md` `lv init` gotcha paragraph to note that merge branches recover one-key-mapping items left by the unquoted pre-`797e2b2` writer. Verify the paragraph reads correctly.
