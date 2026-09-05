<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv init

`lv init` installs and configures OpenSpec in the current repository, then wires OpenSpec’s generated workflows to LV-specific context in `openspec/config.yaml`. It is the CLI entry point for setting up the OpenSpec integration, not for generating feature docs or allocating feature IDs.

## Main components

- `src/index.ts` registers the `lv init` command and its `--tool` option.
- `src/cli/init.ts` performs the install, checks whether `openspec` is available, and updates OpenSpec’s config.
- `src/prompts.ts` holds the static guidance strings that `lv init` writes into `openspec/config.yaml` and related workflow files.

## High-level flow

1. `lv init` resolves the repository root.
2. It checks whether the `openspec` executable is available on `PATH` using `which.sync("openspec", { nothrow: true })` rather than inferring absence from a failed spawn.
3. If OpenSpec is missing, it prompts to install `@fission-ai/openspec` globally with npm. Declining stops the command.
4. It runs `openspec init <repoRoot>`, passing `--tools <tool>` when `--tool` is provided.
5. After installation, it patches OpenSpec-generated files in place:
   - `openspec/config.yaml` gets a `context:` block that points OpenSpec at LV feature docs and the current change state.
   - `openspec/config.yaml` also gets `operations.archive.guidance` telling archive workflows to refresh feature docs before finishing.
   - generated `/opsx:propose` workflow files, when present, are patched to autoload change state before asking for a description and to record the created OpenSpec change back to LV.
6. It prints a success message and suggests starting work with `lv start`.

## Constraints and assumptions

- The command depends on the `openspec` CLI being available on `PATH`, or installable globally via npm.
- The missing-install check treats any unresolved or uncertain result as "not found or not installed properly" rather than trying to distinguish every failure mode.
- `--tool` is optional. When omitted, `openspec init` runs without `--tools` and can use OpenSpec’s own interactive selection.
- `--tool` is forwarded verbatim as a single argv token. The CLI help warns that comma-separated multiple tools must be quoted on PowerShell.
- `openspec init` failures include captured stderr in the printed error message.
- The config writes are intended to be idempotent, including partial reruns where only some lines are missing.
- Fresh-template handling preserves OpenSpec’s scaffold comments by appending raw YAML when a target section is still commented out.
- If `openspec/config.yaml` is missing after install, the command prints an error and skips that patch step.
- The generated `/opsx:propose` workflow patch is opportunistic: if the expected text shape changes upstream, the command logs an error and leaves that file unmodified.

## Current state of the code

The command is implemented and wired into the CLI. It installs OpenSpec, writes LV context into the generated OpenSpec config, and also patches generated propose workflows when those files exist.