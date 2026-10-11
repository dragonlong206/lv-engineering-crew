## 1. Implementation

- [x] 1.1 Add a non-fatal `git fetch origin` as the first step of `createBranch()` in `src/integrations/git/client.ts`; verify `npx tsc --noEmit` passes
- [x] 1.2 In a scratch repo with a remote ahead of the local base, run `lv start` and verify the new branch contains the remote's newest commit; also verify it still succeeds with no remote configured
