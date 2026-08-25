<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# Overview of the 'lv-bootstrap' Feature

## Purpose of the Feature
`lv-bootstrap` generates feature documentation from code. It supports two modes: a path-based mode that reads one or more user-supplied files or directories, and an autonomous scan mode that explores the repository with tools to refine or create existing feature docs.

## Main Components
- **CLI command**: `bootstrap <feature-id>` is registered in `src/index.ts` and described as generating feature docs from code.
- **Bootstrap runner**: `runBootstrap()` in `src/cli/bootstrap.ts` routes to either path-based generation or autonomous scan mode.
- **Document generation agent**: `bootstrapAgent` in `src/cli/bootstrap.ts` is a Mastra `Agent` with id `lv-bootstrap-agent` used for path-based prompt generation.
- **Autonomous scan agent**: `bootstrapScanAgent` in `src/agents/bootstrap-agent.ts` is a Mastra `Agent` with id `lv-bootstrap-scan-agent` and file, search, and list tools attached.
- **Codebase helpers**: `listCodeFiles()` in `src/tools/codebase.ts` recursively finds source and doc files while skipping excluded directories.
- **Configuration and path helpers**: `loadConfig()`, `getRepoRoot()`, and `getFeaturesDir()` in `src/config.ts` locate the repo and feature output directory.
- **Index updater**: `updateIndex()` in `src/cli/bootstrap.ts` appends the feature to `docs/features/INDEX.md` if needed.

## High-Level Flow
1. The user runs `lv bootstrap <feature-id>` with either `--paths` or no paths at all.
2. If `--paths` is provided, `runBootstrapFromPaths()` validates each path, reads file contents, and builds a Markdown code context grouped by relative file path.
3. For directory inputs, the code reads at most 50 files per directory via `listCodeFiles(absDir).slice(0, 50)`.
4. The path-based flow sends the assembled code block to `bootstrapAgent.generate()` twice in parallel, once for `overview.md` and once for `design.md`.
5. If `--paths` is omitted, `runBootstrapFromScan()` reads any existing `overview.md` and `design.md`, builds a scan prompt, and calls `bootstrapScanAgent.generate()` with `maxSteps: 18`.
6. The scan result is parsed as JSON with `overviewMarkdown` and `designMarkdown`, then written to the feature directory with an auto-generated header.
7. In both modes, the command creates the feature directory if needed and updates `docs/features/INDEX.md`.

## Constraints and Assumptions
- The command must run from inside a repo containing `.lv.yaml`, because `loadConfig()` and `getRepoRoot()` search upward for that file.
- Path-based mode accepts a comma-separated `--paths` value, and each entry may be either absolute or relative to the repo root.
- If `--paths` is present, any `--name` or `--description` hint is ignored with a warning.
- Recursive file collection skips `node_modules`, `.git`, `dist`, `__pycache__`, and `.venv`.
- `listCodeFiles()` only includes files with extensions `.ts`, `.js`, `.py`, `.go`, `.java`, `.rb`, `.rs`, `.md`, `.yaml`, `.yml`, and `.json`.
- The autonomous scan mode expects the agent to return strict JSON, not free-form Markdown.
- Generated docs are intentionally marked as auto-generated and are meant for manual review before commit.

## Current State of the Code
`lv-bootstrap` is implemented and wired into the CLI. Both generation modes are present, feature docs are written to `docs/features/<feature-id>/overview.md` and `design.md`, and the feature index is maintained automatically. The code also supports refinement of existing docs in autonomous scan mode by feeding prior content back into the agent prompt.