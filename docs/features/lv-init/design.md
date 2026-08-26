<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv init

## Architecture and layers

`lv init` is a thin CLI orchestration layer over two actions:

1. delegate OpenSpec installation to the external `openspec` CLI
2. post-process the generated OpenSpec config file to inject LV-specific context pointers

The command entry point lives in `src/index.ts`, which dispatches to `runInit()` in `src/cli/init.ts`. Shared instructional strings live in `src/prompts.ts` so the config text is centralized rather than embedded in the CLI implementation.

## Data model / schema

The feature operates on a single file in the target repository: `openspec/config.yaml`.

Two YAML sections are relevant:

- `context:` receives a multi-line block that points OpenSpec at:
  - `docs/features/<feature-id>/{overview.md,design.md}`
  - `docs/changes/<change-id>/state.yaml`
  - an advisory note about running `lv bootstrap <feature-id>` when syncing directly
- `operations.archive.guidance:` receives a list item telling archive workflows to refresh feature docs before completing

The code treats these as idempotent text/YAML additions. It checks whether the generated lines already exist before writing them again.

## APIs / interfaces

### CLI

- `lv init`
- `lv init --tool <tool>`

`--tool` is forwarded to `openspec init --tools <tool>`. If omitted, `openspec init` is invoked without `--tools`.

### Internal functions

- `runInit(opts: { tool?: string })` in `src/cli/init.ts`
- `addContextPointer(repoRoot: string)` in `src/cli/init.ts`
- `addArchiveGuidance(repoRoot: string)` in `src/cli/init.ts`
- `CONTEXT_POINTER_LINES` and `ARCHIVE_GUIDANCE` in `src/prompts.ts`

## Key design decisions

- The command delegates agent support entirely to OpenSpec instead of maintaining its own list of supported coding agents.
- LV writes small config pointers into OpenSpec’s config rather than modifying generated skill or command files directly.
- The config mutations are intentionally idempotent so rerunning `lv init` does not duplicate the integration text.
- Fresh-template handling prefers raw append operations to preserve OpenSpec’s scaffold comments, falling back to YAML parsing only when the target keys are already active and must be merged structurally.
- Feature ID allocation and document analysis were removed from this command, so `lv init` is now purely an installation and wiring step.