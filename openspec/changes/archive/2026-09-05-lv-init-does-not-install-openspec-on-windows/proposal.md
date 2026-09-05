## Why

On Windows, `lv init`'s check for whether the `openspec` CLI is already installed (`isOpenSpecInstalled()` in `src/cli/init.ts`) classifies "not installed" by testing `err.code === "ENOENT"` on the failed `execa("openspec", ["--version"])` call. That check is reliable on POSIX, where Node throws a real `ENOENT` for a missing executable. On Windows, `execa`/`cross-spawn` relay the lookup through `cmd.exe`, and whether the resulting error carries `code: "ENOENT"` depends on an emulation layer with a documented history of unreliability (cross-spawn issues #16 and #104; execa issue #446/PR #447 explored removing the emulation because it produced false negatives).

This is now confirmed, not just inferred: running `execa("openspec", ["--version"])` on Windows with `openspec` absent from `PATH` throws an `ExecaError` with `exitCode: 1` and stderr `'openspec' is not recognized as an internal or external command, operable program or batch file.` — but **no `code` property at all**, so `err.code === "ENOENT"` is `false` and `isOpenSpecInstalled()` re-throws instead of returning `false`. `lv init` then crashes with the unhandled `ExecaError` instead of reaching its "OpenSpec not found → offer to install" flow — matching this ticket's report that `lv init` does not install OpenSpec on Windows.

## What Changes

- Make `isOpenSpecInstalled()`'s "not installed" detection robust on Windows instead of relying solely on `err.code === "ENOENT"`, so a missing `openspec` executable is reliably classified as "not installed" regardless of how the underlying spawn error is shaped on that platform.
- When `isOpenSpecInstalled()` re-throws an error it can't classify, and when the `openspec init` invocation itself fails, include the captured stderr (execa exposes this on its error object) in the printed/thrown message alongside `err.message`, so any remaining Windows-specific spawn failure is diagnosable from the CLI's own output rather than an opaque one-line message.

## Capabilities

### Modified Capabilities
- `lv-init/openspec-bootstrap`: the "lv init detects and offers to install a missing OpenSpec CLI" requirement gains a cross-platform detection guarantee and improved failure diagnostics.

## Impact

- `src/cli/init.ts`: `isOpenSpecInstalled()` (detection logic) and the `openspec init` failure path in `runInit()` (error message construction).
- No changes to `openspec/config.yaml` patching, CLI flags, or `state.yaml`/branch behavior.
