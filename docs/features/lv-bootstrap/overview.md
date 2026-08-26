<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# Overview of the 'lv-bootstrap' Feature

## Purpose of the Feature
`lv-bootstrap` generates and refreshes feature documentation from the repository codebase. It supports two entry modes: a path-based mode that documents user-supplied files or directories, and an autonomous scan mode that explores the repo, reads any existing draft docs, and refines them.

## Main Components
- **CLI command**: `bootstrap <feature-id>` is registered in `src/index.ts`.
- **Bootstrap runner**: `runBootstrap()` in `src/cli/bootstrap.ts` chooses between path-based generation and autonomous scan mode.
- **Path-based generation agent**: an inline Mastra `Agent` named `lv-bootstrap-agent` generates Markdown from a prebuilt code context string.
- **Autonomous scan agent**: `createBootstrapScanAgent()` in `src/agents/bootstrap-agent.ts` creates a Mastra `Agent` named `lv-bootstrap-scan-agent` with repository tools attached.
- **Codebase tools**: `buildCodebaseTools()` and `listCodeFiles()` in `src/tools/codebase.ts` provide file discovery, file reading, and code search support.
- **Configuration helpers**: `loadConfig()`, `getRepoRoot()`, `getFeaturesDir()`, and `getModelForStep()` in `src/config.ts` locate the repo and resolve the model to use.
- **Index updater**: `updateIndex()` in `src/cli/bootstrap.ts` keeps `docs/features/INDEX.md` in sync.

## High-level Flow
1. The user runs `lv bootstrap <feature-id>` with either `--paths` or no paths.
2. If `--paths` is provided, `runBootstrapFromPaths()` validates each path, reads file contents, and builds a Markdown code context grouped by relative file path.
3. For directory inputs, the code recursively collects matching files and limits each directory input to 50 files.
4. The path-based flow sends the assembled code block to the bootstrap agent to generate `overview.md` and `design.md`.
5. If `--paths` is omitted, `runBootstrapFromScan()` reads any existing `overview.md` and `design.md`, builds a scan prompt, and calls the scan agent with `maxSteps: 18`.
6. The scan result is parsed as JSON with `overviewMarkdown` and `designMarkdown`, then written to the feature directory with an auto-generated header.
7. In both modes, the command creates the feature directory if needed and updates `docs/features/INDEX.md`.
8. If a feature is newly created, the command also tries to sync it to the configured Lark Features table when that integration is enabled.

## Constraints and Assumptions
- The command must run from inside a repo containing `.lv.yaml`, because `loadConfig()` and `getRepoRoot()` search upward for that file.
- Path-based mode accepts a comma-separated `--paths` value, and each entry may be either absolute or relative to the repo root.
- If `--paths` is provided, any `--name` or `--description` hint is ignored with a warning.
- Recursive file collection skips common build and dependency directories, including `node_modules`, `.git`, `dist`, `build`, `out`, `__pycache__`, `.venv`, `bin`, `obj`, `.vs`, `packages`, `target`, `vendor`, and `.idea`.
- `listCodeFiles()` matches both source files and several document/config file extensions, not just code files.
- The autonomous scan mode expects the agent to return strict JSON, not free-form Markdown.
- Generated docs are intentionally marked as auto-generated and are meant for manual review before commit.
- The feature index update is append-only unless the exact feature link already exists.
- Lark sync for new features only runs when `lark.features_table_id` and `lark.sync_new_features` are enabled and Lark credentials are available.

## Current State of the Code
`lv-bootstrap` is implemented and wired into the CLI. Both generation modes are present, feature docs are written to `docs/features/<feature-id>/overview.md` and `design.md`, and the feature index is updated automatically. The autonomous scan mode also feeds any existing draft docs back into the agent prompt so they can be refined rather than replaced blindly. New features can optionally be synced to Lark as part of the bootstrap flow.
