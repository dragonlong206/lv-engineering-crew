<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv init

`lv init` installs and configures OpenSpec for the current repository, then wires OpenSpec's generated workflows to LV-specific context. It also installs the `lv-bootstrap` skill (and, for known coding-agent shapes, a matching slash command) into every coding agent it detects OpenSpec was installed for. It is the setup command for OpenSpec integration in LV. It does not generate feature docs itself and it does not allocate feature IDs.

## Main components

- `src/index.ts` registers the `init` command and its `--tool` option.
- `src/cli/init.ts` implements the install-and-patch flow, plus `installLvBootstrapSkill()` for the `lv-bootstrap` skill/command install step.
- `src/prompts.ts` holds the instruction text that `lv init` writes into `openspec/config.yaml`, the generated propose workflow files, and the `lv-bootstrap` skill/command files (`buildLvBootstrapSkillFile()`, `buildLvBootstrapClaudeCommandFile()`, `buildLvBootstrapCursorCommandFile()`).

## High-level flow

1. `lv init` resolves the repository root.
2. It checks whether `openspec` is available on `PATH` using `which.sync("openspec", { nothrow: true })`.
3. If OpenSpec is missing, it prompts to install `@fission-ai/openspec` globally with npm. If the user declines, the command prints a manual install hint and stops.
4. It runs `openspec init <repoRoot>`, passing `--tools <tool>` when `--tool` is provided.
5. After OpenSpec installs, it patches generated files in place:
   - `openspec/config.yaml` gets a `context:` block that points OpenSpec at LV feature docs, the current change state, a convention for `/opsx:sync`, and the configured output language if any.
   - `openspec/config.yaml` gets `operations.archive.guidance` that tells archive workflows to refresh touched feature docs before finishing.
   - generated `/opsx:propose` workflow files, when present, are patched to:
     - autoload change state before asking for a description
     - record the created OpenSpec change back to LV
     - surface `ui_design` when creating a proposal
     - surface downloaded ticket `attachments` when creating a proposal
6. It installs the `lv-bootstrap` skill (and, where a known command shape exists, a slash command) into every coding-agent directory OpenSpec just installed a skill into.
7. It prints a success message and suggests starting work with `lv start`.

## Constraints and assumptions

- The command depends on `openspec` being available on `PATH`, or installable globally via npm as `@fission-ai/openspec`.
- `--tool` is optional. When omitted, `openspec init` runs without a `--tools` argument (its own interactive picker decides).
- The CLI help says multiple tools should be passed as a quoted comma-separated value, for example `--tool "claude,codex"`.
- `openspec init` failures include captured `stderr` in the printed error message.
- The config and skill/command file updates are all idempotent — re-running `lv init` does not duplicate content.
- Fresh-template handling preserves OpenSpec scaffold comments by appending raw YAML when the target key is still commented out.
- If `openspec/config.yaml` is missing after install, the command prints an error and skips that patch step.
- The `/opsx:propose` workflow patches are opportunistic. If the expected upstream text shape changes, the command logs an error and leaves that file unmodified.
- The workflow patches are reapplied whenever OpenSpec regenerates those files.
- The `lv-bootstrap` skill/command install step detects coding agents dynamically (by checking each of the repo root's own subdirectories for `skills/openspec-propose/SKILL.md`), not from a fixed list of tool names — but a slash command is only written for coding agents whose command-file format `lv` has a template for (Claude Code, Cursor, as of this change); every other agent gets the skill only.

## Current state of the code

The command is implemented and wired into the CLI. It installs OpenSpec when needed, writes LV context into the generated OpenSpec config, patches generated propose workflows when those files exist, and installs the `lv-bootstrap` skill/command for every coding agent it detects. The feature reflects the current `src/cli/init.ts` behavior, including `ui_design`/`attachments` handling, output-language guidance, and the `lv-bootstrap` skill/command install step added alongside the conversion of `lv bootstrap`'s own generation modes into a coding-agent skill.
