## 1. Config schema

- [x] 1.1 Add `sync_feature_id: z.boolean().default(true)` to `LarkConfigSchema` in `src/types.ts` and verify `npx tsc --noEmit` passes.
- [x] 1.2 Document `lark.sync_feature_id` in `.lv.yaml`'s `lark:` block, matching the existing `feature_id_field`/`title_field` comment style, and verify the key round-trips through `loadConfig()` (e.g. log `config.lark.sync_feature_id` from a scratch script).

## 2. Lark write-back

- [~] 2.1 Implement a write call in `src/tools/lark.ts` (e.g. `updateTicketFeatureId`) that PATCHes the Bitable record's Feature ID field, reading the field's existing shape (comma-joined string vs array, same branching `fetchTicket` already does on read) from `rawFields` and reproducing that shape with the new ID appended. Verify against a scratch ticket with a string-typed field and one with an array-typed field, confirming each produces the correctly-shaped payload. — *implemented; live verification pending (see note below)*
- [~] 2.2 Decide and implement the function's failure contract (throw vs. return a result) so the caller in `start.ts` can treat a write failure as non-fatal per `design.md`'s Decisions. Verify by simulating a failed PATCH (invalid scope or unreachable network) and confirming the call site doesn't crash. — *implemented (throws; caught non-fatally in start.ts); live failure-path verification pending*

## 3. Inline feature bootstrap in `lv start`

- [~] 3.1 In `src/cli/start.ts`, replace the empty-`featureIds` hard error with a call to `allocateFeatureIds()` (reusing `config.feature_id_prefix`/`config.feature_id_digits`). Verify a scratch ticket with an empty Feature ID field gets a new `Fxxxx` ID printed instead of the command exiting. — *implemented; live verification pending*
- [~] 3.2 Replace the missing-feature-directory hard error with a loop that, for each feature still missing a `docs/features/<id>/` directory, runs the autonomous-scan bootstrap path (`bootstrap.ts`'s scan-mode logic, seeded with `ticket.title`/`ticket.description` as the hint). Verify `docs/features/<id>/{overview,design,requirements}.md` are written for a scratch ticket referencing a never-before-seen feature ID. — *implemented; live verification pending*
- [~] 3.3 After generating docs for every missing feature in this run, print all their file paths together and add a single `confirm()` gate (default decline, `[y/N]`, matching `resume.ts`'s convention) before proceeding to `createBranch()`. Verify declining leaves no branch and no commit (`git status` shows only the untracked/modified feature doc files). — *implemented; live verification pending*
- [~] 3.4 Verify re-running `lv start` for the same ticket after a decline skips regeneration — the existing `fs.existsSync(featureDir)` check already covers this once the directory exists on disk. Confirm by running `lv start` twice against a scratch ticket and checking the docs aren't rewritten the second time. — *relies on existing, unchanged check; live confirmation pending*
- [~] 3.5 Confirm the existing end-of-run `commitAll()` call already sweeps the newly-approved feature docs into the ticket's commit with no code change needed (it stages all dirty files). Verify with `git show` on the resulting commit for a scratch run, confirming it includes both the feature docs and the analysis file. — *no code change needed here; live confirmation pending*

## 4. Lark sync wiring

- [~] 4.1 After a feature ID is newly allocated (task 3.1's path, not the missing-dir-only path) and the review gate in 3.3 is confirmed, call the write-back from task 2.1 when `config.lark.sync_feature_id` is true, and skip it when false. Verify both branches against a scratch ticket with the config toggled each way. — *implemented; live verification pending*
- [~] 4.2 Wrap the sync call so a failure (per task 2.2's contract) prints a clear non-fatal warning and `lv start` continues to branch creation and commit. Verify by pointing the configured app credentials at a token without write scope and confirming `lv start` still completes end to end. — *implemented; live verification pending*

**Note:** tasks 2.1–4.2 above are code-complete and type-check clean (`npx tsc --noEmit`), but their "verify against a scratch ticket" clauses require running `lv start` against a real Lark ticket in the configured Base — which creates a real git branch, pushes it, and (for the sync tasks) can write to a real ticket record. Paused before running that live, pending direction from the user on which ticket/branch is safe to use for the trial. See task 5.2, which is the same live-verification pass.

## 5. End-to-end verification

- [x] 5.1 Run `npx tsc --noEmit` and `npm run build` and verify both succeed.
- [ ] 5.2 Run `lv start <ticket-id>` against scratch Lark tickets covering all three cases — existing feature (unchanged behavior), missing-dir feature (bootstrap + confirm), and empty-Feature-ID feature (allocate + bootstrap + confirm + sync) — and verify each satisfies the scenarios in `specs/lv-start/inline-feature-bootstrap/spec.md` and `specs/lv-start/lark-feature-id-sync/spec.md`.
- [x] 5.3 Update `docs/features/lv-start/overview.md` to describe the new inline-bootstrap and Lark-sync behavior (it currently documents only the hard-error path), per this repo's self-documentation convention. Verify the "High-level flow" and "Constraints and assumptions" sections reflect the new steps.
