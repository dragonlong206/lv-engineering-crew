<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv init

## Architecture and layers

`lv init` is a thin orchestration layer around four responsibilities:

1. delegate installation to the external `openspec` CLI
2. post-process `openspec/config.yaml` to inject LV-specific guidance
3. patch generated OpenSpec workflow files so they cooperate with LV change tracking
4. install the `lv-bootstrap` skill (and, for known coding-agent shapes, a slash command) into every coding agent OpenSpec was just installed for

The CLI entry point lives in `src/index.ts`, which dispatches to `runInit()` in `src/cli/init.ts`. Shared instruction text lives in `src/prompts.ts`, keeping the command implementation focused on file I/O and orchestration.

The config update logic uses two modes:

- raw append for fresh templates, so OpenSpec scaffold comments survive
- YAML parse and rewrite for already-active keys, so existing user customization can be merged structurally

The `lv-bootstrap` skill/command install step is dynamic rather than tied to the `--tool` flag: it detects which coding agents were actually installed by scanning the repo, not by parsing `--tool`'s string (which is `undefined` whenever an engineer lets OpenSpec's own interactive picker decide).

## Data model / schema

The feature operates on OpenSpec's repository-local config file, `openspec/config.yaml`.

It writes or updates these parts of the file:

- `context:` receives a multiline string containing:
  - a reminder to read `docs/features/<feature-id>/{overview.md,design.md}` for touched features
  - a pointer to `docs/changes/<change-id>/state.yaml` for the current change
  - a convention, not an enforced check, to run `lv bootstrap <feature-id>` when syncing specs directly with `/opsx:sync`
  - a reminder to honor `.lv.yaml`'s `output_language` setting when generating prose
- `operations.archive.guidance:` receives one list item instructing archive workflows to refresh the docs of every touched feature before completing

The command also patches generated `/opsx:propose` workflow files in these locations when they exist:

- `.claude/commands/opsx/propose.md`
- `.claude/skills/openspec-propose/SKILL.md`
- `.agents/skills/openspec-propose/SKILL.md`

Those workflow patches insert LV-specific instructions around existing OpenSpec steps:

- a line that autoloads `docs/changes/<change-id>/state.yaml` when the current git branch matches
- a line that records the newly created OpenSpec change with `lv link "<name>"`
- a line that checks `state.yaml` for a `ui_design` reference and, when writing `proposal`, attempts to inspect it and reflect that in proposal text
- a line that checks `state.yaml` for downloaded `attachments` and, when writing `proposal`, reads them directly and reflects that in proposal text

Separately, `installLvBootstrapSkill()` writes:

- `<tool-base-dir>/skills/lv-bootstrap/SKILL.md` for every coding agent detected — identical content across every agent (frontmatter: `name: lv-bootstrap`, `allowed-tools: Bash(lv bootstrap:*)`, `metadata.author: lv`)
- `.claude/commands/lv/bootstrap.md` and `.cursor/commands/lv-bootstrap.md` when that specific agent is detected — the two "known command shapes" `lv` currently has templates for

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
- `addProposeUiDesignInstruction(repoRoot: string)` in `src/cli/init.ts`
- `addProposeAttachmentInstruction(repoRoot: string)` in `src/cli/init.ts`
- `addProposeLinkInstruction(repoRoot: string)` in `src/cli/init.ts`
- `installLvBootstrapSkill(repoRoot: string)` in `src/cli/init.ts`, using `findOpenSpecToolBaseDirs(repoRoot: string)` for detection and the `LV_BOOTSTRAP_KNOWN_COMMAND_SHAPES` map for the command-file step
- `CONTEXT_POINTER_LINES`, `ARCHIVE_GUIDANCE`, `PROPOSE_STATE_AUTOLOAD_LINE`, `PROPOSE_LINK_CHANGE_LINE`, `PROPOSE_UI_DESIGN_LINE`, `PROPOSE_ATTACHMENT_LINE`, `buildLvBootstrapSkillFile()`, `buildLvBootstrapClaudeCommandFile()`, and `buildLvBootstrapCursorCommandFile()` in `src/prompts.ts`

## Key design decisions

- OpenSpec is treated as the external integration layer, so LV delegates tool support to `openspec init` instead of maintaining its own agent matrix for OpenSpec's own workflows.
- Installation detection is path-based and synchronous. This avoids relying on platform-specific spawn error shapes.
- The command captures `openspec init` stderr while still streaming output live to the terminal, so failures can include useful diagnostics.
- `openspec/config.yaml` is updated with whitespace-normalized idempotency checks, so rerunning `lv init` does not duplicate guidance even if formatting changes.
- Fresh templates are patched by appending YAML, preserving generated comments. When a section is already active, the code falls back to YAML parsing and rewriting so missing nested keys can be merged structurally.
- The archive guidance is advisory only. It is read by OpenSpec's generated archive workflow and does not block completion if ignored.
- The `/opsx:propose` workflow patches are best-effort and shape-dependent. They are not driven by `openspec/config.yaml`; they are inserted directly into generated workflow files because those steps need to run before OpenSpec's context instructions are surfaced.
- The UI-design and attachment instructions are scoped to `/opsx:propose` only, because they are only useful when writing the proposal artifact.
- `lv init` is not a full OpenSpec file generator. It leaves OpenSpec's own generated workflows in place and only adds LV-specific context and workflow adjustments.
- Unlike OpenSpec's own tool support, the `lv-bootstrap` skill/command install step is `lv`'s own content, not delegated to `openspec`. It detects target coding agents dynamically (by what OpenSpec actually installed, not a maintained list), but keeps the command-file step scoped to a small, explicit "known shapes" table, since a command file's format varies too much across tools to generalize the way the skill file does.
