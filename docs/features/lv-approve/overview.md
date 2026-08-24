# lv approve

Locks the current step. Sets status = approved, writes approved_at, commits state in the same commit as the artifact. Does not automatically advance to the next step — the engineer must do that explicitly.

## Main code

- `src/cli/approve.ts`
- `src/engine/state-machine.ts` — canRun('approve')
- `src/engine/state-io.ts` — writeState

## Key invariant

writeState and commitAll are always called together. There is no state where state.yaml says "approved" but the artifact file is stale.
