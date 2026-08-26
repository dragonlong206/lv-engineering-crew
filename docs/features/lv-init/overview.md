<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv init

Installs and configures OpenSpec for a chosen coding agent, then wires OpenSpec’s generated workflows to LV’s context files. It is the repo’s entry point for setting up the OpenSpec integration, not for analyzing requirement documents or allocating feature IDs.

## Main components

- `src/cli/init.ts` runs the install step and patches `openspec/config.yaml`.
- `src/index.ts` exposes the `lv init` command and its `--tool` option.
- `src/prompts.ts` provides the static context text that `lv init` writes into OpenSpec config.

## High-level flow

1. `lv init` determines the repository root.
2. It runs `openspec init` in that repo, passing `--tools <tool>` when `--tool` is supplied.
3. After installation, it updates `openspec/config.yaml` with two idempotent additions:
   - a `context:` pointer that tells OpenSpec where to find LV feature docs and change state
   - `operations.archive.guidance` that tells archive workflows to refresh feature docs before finishing
4. It prints a success message and suggests starting a change with `lv start`.

## Constraints and assumptions

- `lv init` depends on the `openspec` executable being available on the PATH.
- The `--tool` option is optional; when omitted, OpenSpec’s own interactive selection is used.
- The config edits are written to `openspec/config.yaml` and are designed to be idempotent.
- The implementation preserves the scaffolded OpenSpec comments when possible by appending to a fresh template instead of always round-tripping through YAML.
- If `openspec/config.yaml` is missing after install, the command logs an error and returns from the config patching step.

## Current state of the code

The command is implemented and wired into the CLI. It no longer reads requirement documents, does not invoke an LLM, does not allocate `Fxxxx` feature IDs, and does not write `docs/features/<id>/overview.md`. The remaining behavior is limited to OpenSpec installation plus config-file wiring.