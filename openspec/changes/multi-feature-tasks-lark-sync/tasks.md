## 1. Config

- [ ] 1.1 Add `lark.features_table_id` and `lark.sync_new_features` (boolean, default `true`) to `ConfigSchema` in `src/types.ts`, and verify `npx tsc --noEmit` passes and `loadConfig()` picks up both from `.lv.yaml`/env vars.
- [ ] 1.2 Document the two new `.lv.yaml` fields with comments in the repo's own `.lv.yaml`, following the existing `lark.sync_feature_id` comment style.

## 2. Multi-feature inference in `lv start`

- [ ] 2.1 Add `buildFeatureSplitPrompt(title, description)` to `src/prompts.ts`, returning a prompt that requests strict JSON `{ features: [{ title: string }, ...] }` with at least one entry.
- [ ] 2.2 In `src/cli/start.ts`, add a function that calls the split prompt through a throwaway single-shot agent (reusing or paralleling `featureMatchAgent`) and parses the result with `extractJson()`, verified by a manual run of `lv start --description "..."` (or a temporary script) against a two-feature description confirming the parsed array has more than one entry.
- [ ] 2.3 Add `confirmFeatureSplit(inferred: {title: string}[])` to `src/cli/helpers.ts`: prints the numbered inferred titles and prompts for Enter-to-accept or a comma-separated replacement list, returning the confirmed titles. Verify with a piped-stdin test (`printf "\n" | ...` for accept, `printf "A,B\n" | ...` for replace) per this repo's existing readline-piping pattern.
- [ ] 2.4 Wire 2.2–2.3 into `startFromTicket()`'s empty-Feature-ID branch (`src/cli/start.ts` ~line 150), replacing the direct `allocateFeatureIds(repoRoot, 1, ...)` call with: infer → confirm → `allocateFeatureIds(repoRoot, confirmed.length, ...)`. Verify a single-feature ticket still allocates exactly one ID (no regression) and a multi-feature description allocates one ID per confirmed title.
- [ ] 2.5 Verify the new branch still respects the existing `matchExistingFeature()` short-circuit — when an existing feature is confirmed as a match, the split/inference step is skipped entirely.

## 3. Lark Features-table sync

- [ ] 3.1 Add `createFeatureRecord(featureId, title, base, tableId, token, ticket?)` to `src/tools/lark.ts`, POSTing a new record to the configured Features table with feature ID, title, and (when `ticket` is passed) a reference back to the ticket. Verify with a unit-level check or manual call against a test Lark Base table.
- [ ] 3.2 Add a `syncFeatureToLarkTable(config, larkToken, featureId, title, ticket?)` wrapper in `src/tools/lark.ts` that no-ops when `lark.sync_new_features` is `false` or `lark.features_table_id` is unset, and swallows/logs failures as a warning without throwing — matching `updateTicketFeatureId`'s existing non-fatal call-site pattern in `startFromTicket()`.
- [ ] 3.3 Call `syncFeatureToLarkTable()` from `runBootstrapFromScan()` in `src/cli/bootstrap.ts`, guarded by the existing `alreadyExists` check (only when `!alreadyExists`), with no ticket. Verify by running `lv bootstrap <new-feature-id>` and confirming a record appears in the test Features table, then re-running for the same ID and confirming no duplicate record is created.
- [ ] 3.4 Add the same new-vs-existing check to `runBootstrapFromPaths()` (mirroring `runBootstrapFromScan()`'s `alreadyExists` pattern) and call `syncFeatureToLarkTable()` there too, with no ticket. Verify with `lv bootstrap <new-feature-id> --paths <path>`.
- [ ] 3.5 In `lv start`'s inline-bootstrap loop over `missingFeatureIds` (`src/cli/start.ts`), call `syncFeatureToLarkTable()` for each generated feature, passing the fetched `ticket`. Verify by running `lv start <ticket-id>` for a ticket with no Feature ID and confirming the created Features-table record(s) reference the ticket.

## 4. Docs

- [ ] 4.1 Run `lv bootstrap lv-start` and `lv bootstrap lv-bootstrap` to refresh their `overview.md`/`design.md` with the new behavior, and review the generated diffs before committing (per `AUTO_GENERATED_HEADER`'s "review, edit, then commit manually" convention).
