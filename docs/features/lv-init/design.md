<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv init

## Architecture and layers

`lv init` is a thin orchestration layer over three responsibilities:

1. delegate installation to the external `openspec` CLI
2. post-process `openspec/config.yaml` to inject LV-specific guidance
3. patch generated OpenSpec workflow files so they cooperate with LV’s change-tracking conventions

The CLI entry point lives in `src/index.ts`, which dispatches to `runInit()` in `src/cli/init.ts`. Reusable instruction text is centralized in `src/prompts.ts`, keeping the command implementation focused on file I/O and orchestration.

The init implementation has two distinct update modes for config files:

- raw append for fresh templates, so OpenSpec’s scaffold comments survive
- YAML parse and re-dump for already-active keys, so existing user customizations can be merged structurally

## Data model / schema

The feature operates on OpenSpec’s repository-local config file, `openspec/config.yaml`.

It writes or updates these parts of the file:

- `context:` receives a multiline string containing:
  - a reminder to read `docs/features/<feature-id>/{overview.md,design.md}` for touched features
  - a pointer to `docs/changes/<change-id>/state.yaml` for the current change
  - a convention, not an enforced check, to run `lv bootstrap <feature-id>` when syncing specs directly
- `operations.archive.guidance:` receives one list item instructing archive workflows to refresh the docs of every touched feature before completing

The command also patches generated `/opsx:propose` workflow files in these locations when they exist:

- `.claude/commands/opsx/propose.md`
- `.claude/skills/openspec-propose/SKILL.md`
- `.agents/skills/openspec-propose/SKILL.md`

Those workflow patches insert two LV-specific lines around the existing OpenSpec steps:

- a line that autoloads `docs/changes/<change-id>/state.yaml` when the current git branch matches
- a line that records the newly created OpenSpec change with `lv link "<name>"`

## APIs / interfaces

### CLI

- `lv init`
- `lv init --tool <tool>`

`--tool` is forwarded to `openspec init --tools <tool>`. If omitted, OpenSpec is launched without a tools argument.

### Internal functions and constants

- `runInit(opts: { tool?: string })` in `src/cli/init.ts`
- `isOpenSpecInstalled(): boolean` in `src/cli/init.ts`, which uses `which.sync("openspec", { nothrow: true })`
- `addContextPointer(repoRoot: string)` in `src/cli/init.ts`
- `addArchiveGuidance(repoRoot: string)` in `src/cli/init.ts`
- `addProposeStateAutoload(repoRoot: string)` in `src/cli/init.ts`
- `addProposeLinkInstruction(repoRoot: string)` in `src/cli/init.ts`
- `CONTEXT_POINTER_LINES`, `ARCHIVE_GUIDANCE`, `PROPOSE_STATE_AUTOLOAD_LINE`, and `PROPOSE_LINK_CHANGE_LINE` in `src/prompts.ts`

## Key design decisions

- OpenSpec is treated as the external integration layer, so LV delegates tool support to `openspec init` instead of maintaining its own agent matrix.
- Installation detection is path-based and synchronous. This avoids relying on platform-specific spawn error shapes, especially on Windows.
- The command captures `openspec init` stderr while still streaming output live to the terminal, so failures can include useful diagnostics.
- `openspec/config.yaml` is updated with whitespace-normalized idempotency checks, so rerunning `lv init` does not duplicate guidance even if formatting changes.
- Fresh templates are patched by appending YAML, preserving generated comments. When a section is already active, the code falls back to YAML parsing and rewriting so missing nested keys can be merged structurally.
- The archive guidance is advisory only. It is read from OpenSpec’s generated archive guidance hook, but it does not block completion if ignored.
- The `/opsx:propose` workflow patches are best-effort and shape-dependent. They are not driven by `openspec/config.yaml`; they are inserted directly into generated workflow files because those steps need to run before OpenSpec’s context instructions are surfaced.
- `lv init` is not a full OpenSpec file generator. It leaves OpenSpec’s own generated workflows in place and only adds LV-specific context and workflow adjustments.