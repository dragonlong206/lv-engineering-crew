## 1. State schema and IO

- [x] 1.1 Add optional `refreshed_features: z.array(z.string()).optional()` to `StateSchema` in `src/types.ts` with an explanatory comment
- [x] 1.2 Add idempotent `markFeatureRefreshed(repoRoot, changeId, featureId)` to `src/engine/state-io.ts`

## 2. lv bootstrap --finalize

- [x] 2.1 In `runBootstrapFinalize()` (`src/cli/bootstrap.ts`), after the index update, resolve the current branch via `currentBranch` + `matchBranch`, and call `markFeatureRefreshed()` when a change and its `state.yaml` exist; never fail finalize otherwise
- [x] 2.2 Update `docs`/skill wording only if `LV_BOOTSTRAP_SKILL_BODY` in `src/prompts.ts` describes what finalize does

## 3. CI

- [x] 3.1 In `scripts/ci/resolve-merged-change.mjs`, subtract `state.refreshed_features` from the emitted `feature-ids` and log the skipped IDs
- [x] 3.2 Update the comment header in `.github/workflows/archive-on-merge.yml` to mention that already-refreshed features are skipped

## 4. Verification

- [x] 4.1 Test "Finalize on a change branch" and "Finalize run more than once": run `lv bootstrap <id> --finalize --title ...` twice on a scratch change branch and check `refreshed_features` has the ID once
- [x] 4.2 Test "Finalize off a change branch" and "Legacy state.yaml": run finalize on `main`/a non-change branch and confirm success with no `state.yaml` change
- [x] 4.3 Test the three CI skip scenarios (already refreshed, mixed, all refreshed): run `resolve-merged-change.mjs` against fixture `state.yaml` files and check the `feature-ids` output
- [x] 4.4 Run `npx tsc --noEmit` and `npm run build`
