## 1. Schema and git helpers

- [x] 1.1 Add optional `big_feature: boolean` and `base_branch: string` to `StateSchema` in `src/types.ts`; verify `npx tsc --noEmit` passes and an existing `state.yaml` still parses
- [x] 1.2 Add `readFileAtRef(repoRoot, ref, path)` to `src/integrations/git/client.ts` (`git show`, returns `undefined` on failure); verify against a scratch repo for local and `origin/` refs
- [x] 1.3 Show `base_branch` (and big-feature marker) in `printStateSummary()` in `src/cli/status.ts`; verify via `lv status` on a scratch change (scenario: Status shows the base)

## 2. Parent big-feature branch

- [x] 2.1 Add `confirmBigFeatureFlow()` to `src/cli/helpers.ts` following `confirm()` conventions; verify prompt text manually
- [x] 2.2 In `startFromTicket()`, ask the question after a confirmed split, and after sub-tickets are created (skipping when none were created) create the parent branch from `baseBranch`, write `state.yaml` with `big_feature: true`, `commitAll`, and push (non-fatal warn); verify scenarios "Parent branch created and pushed", "Push fails", "No sub-task was created", "Declining the flow keeps current behavior" against a scratch repo with an unreachable remote
- [x] 2.3 Update the post-split guidance text to mention the big-feature branch when created; verify output

## 3. Sub-task start

- [x] 3.1 Add `findBigFeatureBranch(repoRoot, config, parentId)` in `src/engine/` using `findChangeBranches` + `readFileAtRef`; verify scenarios "Parent has a big-feature branch", "Parent has no big-feature branch", "Big-feature branch only exists on the remote"
- [x] 3.2 Use it in `startFromTicket()` after the parent fetch to override the fork base and write `base_branch` into the sub-task `state.yaml`; warn when the parent fetch failed that detection was skipped; verify branch ancestry with `git merge-base`
- [x] 3.3 Print the PR target in `printNextSteps()`; verify scenario "Next-steps hint after start"

## 4. Docs and PR tooling

- [x] 4.1 Update `docs/features/lv-start/{overview,design}.md` and the CLAUDE.md ticket-pipeline paragraph; verify they describe the flow
- [x] 4.2 Update the `commit-push-pr` skill (where it lives in this repo) to use `base_branch` from `state.yaml` as the PR base when present; verify the text, and `npm run build` passes
