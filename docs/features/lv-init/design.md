<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv init

## Architecture and layers

`lv init` is a thin orchestration layer over two responsibilities:

1. delegate installation to the external `openspec` CLI
2. post-process the generated OpenSpec config file to inject LV-specific guidance

The CLI entry point is defined in `src/index.ts`, which dispatches to `runInit()` in `src/cli/init.ts`. The reusable text that gets injected into OpenSpec lives in `src/prompts.ts`, keeping the configuration content centralized instead of embedded in the command implementation.

## Data model / schema

The feature operates on a single file in the target repository: `openspec/config.yaml`.

The code writes two OpenSpec config areas:

- `context:` receives a block scalar containing lines that point OpenSpec at:
  - `docs/features/<feature-id>/{overview.md,design.md}`
  - `docs/changes/<change-id>/state.yaml`
  - an advisory note about running `lv bootstrap <feature-id>` directly when syncing specs
- `operations.archive.guidance:` receives a single list item instructing archive workflows to refresh feature docs before completion

Both additions are checked using whitespace-normalized string comparison so reruns do not duplicate content even if YAML formatting changes.

## APIs / interfaces

### CLI

- `lv init`
- `lv init --tool <tool>`

`--tool` is forwarded to `openspec init --tools <tool>`. If the option is omitted, `openspec init` is invoked without a tools argument.

### Internal functions

- `runInit(opts: { tool?: string })` in `src/cli/init.ts`
- `addContextPointer(repoRoot: string)` in `src/cli/init.ts`
- `addArchiveGuidance(repoRoot: string)` in `src/cli/init.ts`
- `isOpenSpecInstalled(): boolean` in `src/cli/init.ts` — synchronous, resolves `openspec` via `which.sync("openspec", { nothrow: true })` instead of spawning `openspec --version` and inspecting the error shape
- `CONTEXT_POINTER_LINES` and `ARCHIVE_GUIDANCE` in `src/prompts.ts`

## Key design decisions

- `isOpenSpecInstalled()` checks `PATH` directly via the `which` package (added as a direct dependency, mirroring the same resolver `execa`'s own dependency `cross-spawn` uses internally) instead of spawning `openspec --version` and inferring "not installed" from the shape of the resulting error. The latter is unreliable on Windows: `execa`/`cross-spawn` relay a missing executable through `cmd.exe`, and whether the rejection carries `code: "ENOENT"` depends on an emulation layer that doesn't always fire — confirmed by a captured Windows repro (`ExecaError`, `exitCode: 1`, no `code` property at all). `which.sync(..., { nothrow: true })` never throws, so any check failure (not just "genuinely absent") is folded into "not installed"; the install prompt is worded "not found or not installed properly" to reflect that.
- The `openspec init` invocation uses fanned-out stdio (`stdout: "inherit"`, `stderr: ["pipe", "inherit"]`) so its output still streams live to the terminal while also being captured — a plain `stdio: "inherit"` config (the original implementation) prevents execa from ever populating `err.stderr`, which would make appending it to failure messages silently useless. On failure, the captured `stderr` is appended to the printed error alongside `err.message`.
- OpenSpec is treated as the agent-specific integration layer, so LV avoids maintaining its own coding-agent matrix.
- LV updates only OpenSpec’s project-level config rather than rewriting generated command or skill files.
- The config patches are idempotent and line-aware, so rerunning `lv init` can fill in missing lines without duplicating existing text.
- Fresh repos preserve the generated OpenSpec template comments by appending new YAML blocks instead of round-tripping through `js-yaml`.
- If a target section is already active, the code falls back to YAML parsing and rewriting so nested keys can be merged structurally, even though that rewrite may drop template comments.