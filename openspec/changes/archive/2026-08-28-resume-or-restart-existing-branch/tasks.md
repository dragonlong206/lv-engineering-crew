## 1. Branch lookup and discard helpers

- [x] 1.1 Extract a shared `findChangeBranches(repoRoot, config, changeId)` helper (composing `matchBranch()`/`branchGlobs()`/`listBranchesMatching()`, filtered by `matchBranch(...).ticketId === changeId`) so both `lv start` and `lv resume` use one lookup; update `src/cli/resume.ts` to call it and verify `npx tsc --noEmit` passes with no behavior change (same branches resolve as before).
- [x] 1.2 Add `discardLocalBranch(repoRoot, branchName, fromBranch)` to `src/integrations/git/client.ts` (checkout `fromBranch`, then `git branch -D branchName`); verify in a scratch repo: create a branch, discard it, confirm `git branch --list` no longer shows it and the base branch is checked out.

## 2. Resume/restart prompt

- [x] 2.1 Add `promptResumeOrRestart(branchName: string): Promise<'resume' | 'restart'>` to `src/cli/helpers.ts`, stating that restart discards the branch's local history; verify with piped stdin (`printf "1\n" | ...` / `printf "2\n" | ...`) per this repo's non-TTY prompt-testing pattern.

## 3. Wire into `lv start` (ticket-based)

- [x] 3.1 In `startFromTicket()`, before fetching Lark credentials/the ticket, call `findChangeBranches(repoRoot, config, ticketId)`; if empty, fall through to the existing flow unchanged; if more than one, resolve via `promptSelect()` as `lv resume` does. Verify: no existing branch still runs the full flow with no prompt.
- [x] 3.2 When exactly one branch is found, call `promptResumeOrRestart()`. On **resume**: `checkoutBranch(repoRoot, branchName)`; if `stateExists(repoRoot, ticketId)`, `readState()` + `printStateSummary()` (from `src/cli/status.ts`) and return without calling Lark; otherwise keep `branchName` and skip the later `createBranch()` call, continuing into the existing ticket-fetch/feature-discovery/doc-generation/Lark-sync/`writeState()`/`commitAll()` sequence on that branch. Verify both sub-cases in a scratch repo (branch with `state.yaml` vs. branch without).
- [x] 3.3 On **restart**: call `discardLocalBranch(repoRoot, branchName, config.default_branch)`, then continue into the unchanged flow (ticket fetch through `createBranch()`/`writeState()`/`commitAll()`) exactly as a first-time start. Verify the branch is recreated fresh and `state.yaml` is overwritten with new content.

## 4. Wire into `lv start` (description-based)

- [x] 4.1 In `startFromDescription()`, move the `findChangeBranches()` check to run immediately after `changeId` is derived, before `matchExistingFeature()`, reusing the same resume/restart handling from Task 3 (checkout + `stateExists()` branch, or `discardLocalBranch()` + fall-through). Verify all three cases (no existing branch, resume with/without `state.yaml`, restart) in a scratch repo using `--description`.

## 5. Verification

- [x] 5.1 Run `npx tsc --noEmit` and `npm run build`; confirm both succeed with no type errors.
- [x] 5.2 Manually run `lv start` (or `npm run dev -- start ...`) twice against the same ticket/description in a scratch repo, covering: no existing branch, resume with `state.yaml`, resume without `state.yaml`, and restart — confirming the resulting branch and `docs/changes/<id>/state.yaml` content after each run.
