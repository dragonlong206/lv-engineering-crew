<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv init

`lv init` installs and configures OpenSpec in the current repository, then wires OpenSpec-generated workflows to LV-specific context. It is the setup command for OpenSpec integration. It does not generate feature docs and it does not allocate feature IDs.

## Main components

- `src/index.ts` registers the `init` command and its `--tool` option.
- `src/cli/init.ts` implements the installation flow, checks whether `openspec` is available, runs `openspec init`, and patches OpenSpec-generated files.
- `src/prompts.ts` holds the instruction strings that `lv init` writes into OpenSpec config and workflow files.

## High-level flow

1. `lv init` resolves the repository root.
2. It checks for `openspec` on `PATH` with `which.sync("openspec", { nothrow: true })`.
3. If OpenSpec is missing, it prompts to install `@fission-ai/openspec` globally with npm. Declining stops the command.
4. It runs `openspec init <repoRoot>`, passing `--tools <tool>` when `--tool` is provided.
5. After installation, it updates generated OpenSpec files in place:
   - `openspec/config.yaml` gets a `context:` block that points OpenSpec at LV feature docs and the current change state.
   - `openspec/config.yaml` gets `operations.archive.guidance` telling archive workflows to refresh touched feature docs before finishing.
   - generated `/opsx:propose` workflow files, when present, are patched to autoload change state before asking for a description, to record the created OpenSpec change back to LV, and to surface `ui_design` when creating a proposal.
6. It prints a success message and suggests starting work with `lv start`.

## Constraints and assumptions

- The command depends on the `openspec` CLI being available on `PATH`, or installable globally via npm.
- `--tool` is optional. When omitted, `openspec init` runs without a tools argument.
- `--tool` is forwarded as a single argument token. The CLI help warns that comma-separated multiple tools must be quoted on PowerShell.
- `openspec init` failures include captured stderr in the printed error message.
- The config writes are intended to be idempotent.
- Fresh-template handling preserves OpenSpec scaffold comments by appending raw YAML when a target section is still commented out.
- If `openspec/config.yaml` is missing after install, the command prints an error and skips that patch step.
- The generated `/opsx:propose` workflow patches are opportunistic: if the expected text shape changes upstream, the command logs an error and leaves that file unmodified.
- The workflow patches are reapplied whenever OpenSpec regenerates those files.

## Current state of the code

The command is implemented and wired into the CLI. It installs OpenSpec, writes LV context into the generated OpenSpec config, and patches generated propose workflows when those files exist.