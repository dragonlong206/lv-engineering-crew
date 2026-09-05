## 1. Dependency

- [x] 1.1 Add `which` as a direct dependency in `package.json` (pin to the version already resolved transitively via `cross-spawn`) and verify `npm install` succeeds with no version conflict

## 2. Detection fix

- [x] 2.1 Rewrite `isOpenSpecInstalled()` in `src/cli/init.ts` to resolve `openspec` via `which.sync("openspec", { nothrow: true })` instead of inspecting the error shape from `execa("openspec", ["--version"])`, returning `true`/`false` based on whether a path is resolved, and verify with `npx tsc --noEmit`
- [x] 2.2 Verify the existing "OpenSpec already installed" and "OpenSpec missing, engineer confirms/declines install" flows still work by running `lv init` against a scratch repo with `openspec` present, then with it temporarily removed from `PATH`

## 3. Diagnostics

- [x] 3.1 In `runInit()`'s `openspec init` failure path, append the execa error's `stderr` (when non-empty) to the message passed to `printError`, and verify by forcing a failure (e.g. temporarily renaming the target repo's `openspec/` dir permissions or passing an invalid `--tools` value) and confirming the printed error includes the underlying stderr text
- [x] 3.2 Update `docs/features/lv-init/{overview.md,design.md}` to reflect the new `which`-based detection, then review and commit manually per this repo's convention (`lv bootstrap` does not auto-commit)

## 4. Verification

- [x] 4.1 Run `npx tsc --noEmit` and `npm run build` and confirm both succeed
- [x] 4.2 Run `lv init` end-to-end against a scratch repo on this machine (POSIX) to confirm no regression in the existing install/prompt flow
- [ ] 4.3 Verify on Windows: with `openspec` removed from `PATH`, confirm `lv init` now detects it as missing and offers the install prompt instead of crashing with the `ExecaError` captured in this change's Why/Context
