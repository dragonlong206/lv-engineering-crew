## Why

`lv start` creates the change branch by checking out the base branch and running `git pull --ff-only`, swallowing any failure. The engineer's local base branch (or its remote-tracking ref) can be stale or absent, so the new branch can fork from outdated commits. The base branch should be brought up to date from the remote — fetching the latest commits first — before the new branch is created.

## What Changes

- Before `lv start` checks out the base branch and fast-forwards it, it SHALL first run `git fetch origin` so remote-tracking refs (including a base branch not yet present locally) are current.
- A failed fetch (no remote, offline) remains non-fatal: `lv start` warns-by-continuing and creates the branch from the local base, as it does today when the pull fails.
- Applies to every `createBranch()` call site (fresh start, big-feature parent branch, sub-ticket fork from a big-feature branch).

## Capabilities

### New Capabilities
- `lv-start/fetch-before-branch-create`: `lv start` fetches the latest remote commits before updating the base branch and forking the new change branch.

### Modified Capabilities

## Impact

- `src/integrations/git/client.ts`: `createBranch()` gains a leading non-fatal `git fetch origin`.
- No config, state schema, or CLI surface changes.
