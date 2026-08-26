## Why

`lv init` currently assumes the `openspec` executable is already on the `PATH` and fails outright (`OpenSpec install failed: ...`) if it isn't. Every engineer's first `lv init` on a fresh machine hits this unless they've separately discovered and run `npm install -g @fission-ai/openspec` themselves — worth noting the unscoped `openspec` package on npm is an unrelated, unmaintained package, so the correct install command isn't guessable from the CLI's own name. `lv init` should detect a missing install and offer to install it, rather than making the engineer diagnose and fix this by hand.

## What Changes

- Before shelling out to `openspec init`, `lv init` checks whether the `openspec` executable resolves (`openspec --version`) and treats `ENOENT` as "not installed."
- If not installed, `lv init` prompts the engineer to confirm installing `@fission-ai/openspec` globally via `npm install -g @fission-ai/openspec` before continuing.
- If the engineer confirms, `lv init` runs that install, then proceeds with `openspec init` as before.
- If the engineer declines, `lv init` stops without running `openspec init` or touching `openspec/config.yaml`, printing how to install manually.
- If the global install itself fails (npm error, no network, permissions), `lv init` reports the failure and stops, the same way it already does for a failed `openspec init`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `lv-init/openspec-bootstrap`: adds a requirement that `lv init` detects a missing OpenSpec CLI and offers to install it before delegating to `openspec init`

## Impact

- `src/cli/init.ts`: add a detection step and a confirm-then-install step ahead of the existing `execa("openspec", args, ...)` call, reusing `confirm()` from `src/cli/helpers.ts`.
- No change to `openspec/config.yaml` wiring (`addContextPointer`/`addArchiveGuidance`) or to any other command.
