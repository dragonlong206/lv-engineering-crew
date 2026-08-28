## Why

`lv start <ticket-id>` always tries to create a fresh branch (`git checkout -b`), which fails outright if a branch for that change already exists — e.g. the engineer re-runs `lv start` on a ticket they already started, or a branch was created (manually, or by a prior run that got interrupted) before `docs/changes/<change-id>/state.yaml` was ever written. The engineer currently has no supported way to pick back up; they have to intervene manually before `lv start` will run again.

## What Changes

- Before creating a branch, `lv start` checks whether a branch for the change already exists (locally or on `origin`).
- If it does, `lv start` stops and asks the engineer to choose **resume** or **restart** instead of failing on `git checkout -b`.
  - **Resume**: check out the existing branch and continue. If `docs/changes/<change-id>/state.yaml` is missing (the branch exists but the change was never fully started), continue through the rest of the start flow to produce it instead of stopping — otherwise, resuming behaves like `lv resume`.
  - **Restart**: discard the existing branch and run the full start flow from scratch, as if the branch had never existed.
- This applies to both start entry modes (ticket-based and `--description`-based), since both call the same branch-creation step.

## Capabilities

### New Capabilities
- `lv-start/resume-or-restart-existing-branch`: detecting an already-existing change branch during `lv start` and prompting the engineer to resume or restart instead of failing.

### Modified Capabilities
(none — branch creation for the no-conflict case is unchanged)

## Impact

- `src/cli/start.ts`: both `startFromTicket()` and `startFromDescription()` need a pre-branch-creation existence check and a resume/restart branch point.
- `src/integrations/git/client.ts`: needs a way to check whether a branch already exists (locally/on origin) and, for restart, to discard it.
- `src/cli/helpers.ts`: reuse or extend `promptSelect()`/`confirm()` for the resume-vs-restart prompt.
- `src/engine/state-io.ts`: `stateExists()` is reused to detect the "branch exists but no state.yaml" case.
