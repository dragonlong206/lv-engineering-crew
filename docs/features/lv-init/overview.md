<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv init

`lv init` installs OpenSpec in the current repository and wires OpenSpec’s generated workflows to LV-specific context stored in `openspec/config.yaml`. It is the CLI entry point for setting up the OpenSpec integration, not for generating feature docs or allocating feature IDs.

## Main components

- `src/index.ts` registers the `lv init` command and its `--tool` option.
- `src/cli/init.ts` performs the install, checks for OpenSpec, and updates `openspec/config.yaml`.
- `src/prompts.ts` holds the static text that gets written into OpenSpec’s config.

## High-level flow

1. `lv init` resolves the repository root.
2. It checks whether the `openspec` executable is available by resolving it on `PATH` directly (via the `which` package), rather than inferring "not installed" from the shape of a failed `execa("openspec", ["--version"])` call — the latter is unreliable on Windows, where a missing executable doesn't always surface a distinguishable error.
3. If OpenSpec is missing (or the check can't cleanly tell it apart from "installed but broken"), it prompts to install `@fission-ai/openspec` globally with `npm`.
4. It runs `openspec init <repoRoot>` and passes `--tools <tool>` when `--tool` is provided.
5. After installation, it patches `openspec/config.yaml` with two idempotent additions:
   - a `context:` block that points OpenSpec at LV feature docs and the current change state
   - `operations.archive.guidance` telling archive workflows to refresh feature docs before finishing
6. It prints a success message and suggests starting a change with `lv start`.

## Constraints and assumptions

- The command depends on the `openspec` CLI being available on the PATH, or installable globally via `npm`.
- Detection can't distinguish "genuinely not installed" from "the check itself failed for some other reason" (e.g. an unreadable `PATH` entry) — both are treated as "not installed" and offered the same install prompt, worded "not found or not installed properly" to reflect that ambiguity.
- When `openspec init` itself fails, the printed error includes the captured stderr from the failed command in addition to the exception message.
- `--tool` is optional. When omitted, `openspec init` runs without `--tools` and can use OpenSpec’s own interactive selection.
- The config edits are intended to be idempotent, including partial re-runs where only some lines are missing.
- Fresh-template handling preserves OpenSpec’s scaffold comments by appending raw YAML when the relevant top-level key is still commented out.
- If `openspec/config.yaml` is missing after install, the command prints an error and skips that patch step.
- This feature no longer reads requirement documents, invokes an LLM, or allocates `Fxxxx` feature IDs.

## Current state of the code

The command is implemented and wired into the CLI. It installs OpenSpec, writes LV context into the generated OpenSpec config, and nothing else.