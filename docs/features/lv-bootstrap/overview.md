<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# Overview of the `lv-bootstrap` Feature

## Purpose of the Feature
`lv-bootstrap` generates or refreshes feature documentation under `docs/features/<feature-id>/` by grounding the docs in the actual repository code. It supports three modes: path-based generation from user-supplied files, autonomous repository scanning, and a new-feature placeholder mode for features with no code yet.

## Main Components
- **CLI command**: `bootstrap <feature-id>` is registered in `src/index.ts`.
- **Bootstrap runner**: `runBootstrap()` in `src/cli/bootstrap.ts` selects placeholder, path-based, or scan-based generation.
- **Path-based generation agent**: an inline Mastra `Agent` named `lv-bootstrap-agent` generates `overview.md` and `design.md` from a prebuilt code context string.
- **Autonomous scan agent**: `createBootstrapScanAgent()` in `src/agents/bootstrap-agent.ts` creates a Mastra `Agent` named `lv-bootstrap-scan-agent` with repository tools attached.
- **Codebase tools**: `buildCodebaseTools()` and `listCodeFiles()` in `src/tools/codebase.ts` provide file discovery, file reading, and code search.
- **Prompt builders and shared text**: `src/prompts.ts` defines the bootstrap prompts, the auto-generated header, and placeholder doc templates.
- **Config helpers**: `loadConfig()`, `getRepoRoot()`, `getFeaturesDir()`, and `getModelForStep()` in `src/config.ts` locate the repo and resolve the model to use.
- **Index updater**: `updateIndex()` in `src/cli/bootstrap.ts` maintains `docs/features/INDEX.md`.
- **Optional Lark sync**: `syncNewFeatureToLark()` in `src/cli/bootstrap.ts` can sync a generated feature to the configured Lark Features table.

## High-level Flow
1. The user runs `lv bootstrap <feature-id>` with either `--new-feature`, `--paths`, or no path arguments.
2. If `--new-feature` is set, the command writes placeholder-only `overview.md` and `design.md` files without scanning code.
3. If `--paths` is provided, `runBootstrapFromPaths()` validates each path, reads file contents, and builds a Markdown code context grouped by relative file path.
4. For directory inputs, the code recursively collects matching files and limits each directory input to 50 files.
5. The path-based flow sends the assembled code block to the bootstrap agent to generate `overview.md` and `design.md`.
6. If `--paths` is omitted and `--new-feature` is not set, `runBootstrapFromScan()` reads any existing `overview.md` and `design.md`, builds a scan prompt, and calls the scan agent with `maxSteps: 18`.
7. The scan result is parsed as JSON with `overviewMarkdown` and `designMarkdown`, then written to the feature directory with an auto-generated header.
8. In all modes, the command creates the feature directory if needed and updates `docs/features/INDEX.md`.
9. After generation, the command may also sync a new feature to Lark when that integration is enabled in config and the required credentials are available.

## Constraints and Assumptions
- The command must run from inside a repo containing `.lv.yaml`, because `loadConfig()` and `getRepoRoot()` search upward for that file.
- Path-based mode accepts a comma-separated `--paths` value, and each entry may be absolute or relative to the repo root.
- If `--paths` is provided, any `--name` or `--description` hint is ignored with a warning.
- If `--new-feature` is provided, `--paths`, `--name`, and `--description` are ignored with a warning.
- Recursive file collection skips common build and dependency directories, including `node_modules`, `.git`, `dist`, `build`, `out`, `__pycache__`, `.venv`, `bin`, `obj`, `.vs`, `packages`, `target`, `vendor`, and `.idea`.
- `listCodeFiles()` matches source files and several document and config file extensions, including `md`, `yaml`, `yml`, `json`, `xml`, `config`, and `sql`.
- The autonomous scan mode expects the agent to return strict JSON, not free-form Markdown.
- Generated docs are marked as auto-generated and are intended for manual review before commit.
- The feature index update is append-only unless the exact feature link or feature marker already exists.
- Lark sync for new features only runs when `lark.features_table_id` and `lark.sync_new_features` are enabled and the app credentials are present.

## Current State of the Code
`lv-bootstrap` is implemented and wired into the CLI. All three generation modes are present, feature docs are written to `docs/features/<feature-id>/overview.md` and `design.md`, and the feature index is updated automatically. The autonomous scan mode also feeds any existing draft docs back into the agent prompt so they can be refined rather than replaced blindly. New features can optionally be synced to Lark as part of the bootstrap flow.