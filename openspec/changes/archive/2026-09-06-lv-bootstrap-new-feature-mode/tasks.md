## 1. Placeholder generation core

- [x] 1.1 Add `generateFeatureDocsPlaceholder(repoRoot, featureId): GeneratedFeatureDocs` to `src/cli/bootstrap.ts` that writes `overview.md`/`design.md` with only the standard section headings, wrapped in `AUTO_GENERATED_HEADER`, then calls `updateIndex()` — verify by calling it directly (or via a scratch script) against a temp feature dir and confirming both files exist, contain only headings, and start with the auto-generated header
- [x] 1.2 Add placeholder section-heading constants/templates to `src/prompts.ts` (or inline in `bootstrap.ts` if `prompts.ts`'s scope is LLM/instructional text only per its centralization convention — check `feedback_prompts_centralization` precedent before deciding) matching the headings used by `buildBootstrapOverviewPrompt`/`buildBootstrapDesignPrompt` output shape

## 2. `lv bootstrap --new-feature` CLI flag

- [x] 2.1 Add `--new-feature` boolean option to the `bootstrap` command in `src/index.ts` and thread it into `runBootstrap()`
- [x] 2.2 In `runBootstrap()`, branch to `generateFeatureDocsPlaceholder()` when `newFeature` is true, before the existing `pathsArg` check; print a warning (matching the existing `--paths`-ignores-hint style) if `--paths`, `--name`, or `--description` were also passed — verify with `npm run dev -- bootstrap <id> --new-feature` against a scratch repo, and again with `--new-feature --paths foo` to confirm the warning fires and placeholder mode still wins
- [x] 2.3 Verify placeholder-mode output is followed by the same "Files written (not committed) / review, edit, then commit manually" console output as the other two modes

## 3. Wire `lv start`'s inline bootstrap to placeholder mode

- [x] 3.1 In `src/cli/start.ts` (around line 331), replace the `generateFeatureDocsFromScan(config, repoRoot, featureId, {...})` call in the missing-feature-directory branch with `generateFeatureDocsPlaceholder(repoRoot, featureId)`
- [x] 3.2 Update the title used for Lark Features-table sync at that call site to fall back to `hint?.name ?? featureId` (no generated overview content to derive a title from) — verify by running `lv start` against a scratch ticket referencing a brand-new feature ID and confirming the synced title matches the ticket title
- [x] 3.3 Run `lv start` end-to-end against a scratch repo/ticket referencing a feature with no `docs/features/<id>/` directory and verify: placeholder docs are written, the existing human-review confirmation prompt still appears before branch creation, and confirming still commits the placeholder docs alongside `state.yaml`

## 4. Type-check and build

- [x] 4.1 Run `npx tsc --noEmit` and fix any type errors
- [x] 4.2 Run `npm run build` and confirm it completes without errors
