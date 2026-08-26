## Context

`runInit()` (`src/cli/init.ts`) currently calls `execa("openspec", args, { cwd: repoRoot, stdio: "inherit" })` directly and treats any failure — including "executable not found" — as an install failure, printing `OpenSpec install failed: ...` and exiting. See proposal.md - Why.

One fact worth recording here because it isn't discoverable from the CLI itself: the unscoped npm package `openspec` is an unrelated package (`openspec@0.0.0`, no relation to this tool). The actual CLI ships as `@fission-ai/openspec` (bin name `openspec`) — confirmed against this machine's global npm install, which resolves `openspec` on `PATH` to `@fission-ai/openspec@1.10.0`. Any install step must reference `@fission-ai/openspec` explicitly, never bare `openspec`.

## Goals / Non-Goals

**Goals:**
- Detect a missing OpenSpec CLI before attempting to delegate to it.
- Get the engineer to a working `lv init` with one confirmation, not a manual troubleshooting detour.

**Non-Goals:**
- Version pinning/upgrading an already-installed OpenSpec CLI (out of scope — this only handles "not installed at all").
- Supporting install via package managers other than npm (matches this repo's own canonical package manager per CLAUDE.md).
- Local/per-repo installs — global install only, per the chosen scope.

## Decisions

**Detection: `execa("openspec", ["--version"])`, catch ENOENT specifically.**
Reuses the same `execa` pattern already used for `openspec init`, so no new dependency. Checking specifically for `ENOENT` (rather than treating any non-zero exit as "not installed") matters because a mis-invoked `--version` flag or a broken-but-present install should surface as its own error, not silently trigger a reinstall attempt. Alternative considered: `npm ls -g @fission-ai/openspec` — rejected because it's package-manager-specific and misses an OpenSpec CLI installed by other means (pnpm, a local build, a different global prefix); a `PATH` check works no matter how it got there.

**Install: prompt via `confirm()`, then `npm install -g @fission-ai/openspec` on yes.**
`confirm()` already exists in `src/cli/helpers.ts` and is used elsewhere in the CLI for review gates (e.g. inline feature bootstrap in `lv start`). A global npm install is a machine-wide side effect outside the target repo, so — per the chosen behavior — it is gated behind an explicit yes, not run silently. On decline, `runInit()` returns early (before calling `openspec init` or either config-patching function), printing the manual install command (`npm install -g @fission-ai/openspec`) so the engineer isn't left without a next step.

**Failure handling mirrors the existing `openspec init` failure path.**
If the global install itself throws, print an error and `process.exit(1)`, the same shape `runInit()` already uses for a failed `openspec init` — no new error-handling pattern introduced.

## Risks / Trade-offs

- [Engineer's npm global prefix isn't on `PATH`] → Out of scope: this is an environment problem `npm install -g` itself would already suffer from; not something `lv init` can fix. The failure path still surfaces npm's own output (`stdio: "inherit"`), giving the engineer what they need to diagnose it.
- [A future OpenSpec CLI package rename breaks the hardcoded `@fission-ai/openspec` string] → Accepted: the string only appears once, in the install command; low-cost to update if it ever changes.
