## 1. Detection and install

- [x] 1.1 In `src/cli/init.ts`, add a function that checks whether `openspec` is resolvable by running `execa("openspec", ["--version"])`, returning `false` only on `ENOENT` and re-throwing any other error.
- [x] 1.2 In `runInit()`, call this check before the existing `execa("openspec", args, ...)` call.
- [x] 1.3 If not resolvable, prompt via `confirm()` (from `src/cli/helpers.ts`) asking to install `@fission-ai/openspec` globally.
- [x] 1.4 On confirm, run `npm install -g @fission-ai/openspec` via `execa` with `stdio: "inherit"`; on failure, print the error and `process.exit(1)` (mirroring the existing `openspec init` failure handling) without proceeding to `openspec init`.
- [x] 1.5 On decline, print the manual install command (`npm install -g @fission-ai/openspec`) and return from `runInit()` without calling `openspec init`, `addContextPointer()`, or `addArchiveGuidance()`.

## 2. Verification

- [x] 2.1 Run `npx tsc --noEmit` to confirm the new code type-checks.
- [x] 2.2 Manually verify: temporarily rename/shadow the `openspec` binary off `PATH`, run `lv init` from source (`npm run dev -- init`), confirm the install prompt appears, decline it, and confirm no `openspec/config.yaml` changes occur.
- [x] 2.3 Manually verify: run `lv init` from source with `openspec` already on `PATH` (the common case) and confirm it proceeds straight to `openspec init` with no prompt.
