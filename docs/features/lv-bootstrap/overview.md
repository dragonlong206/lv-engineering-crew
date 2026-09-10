<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# Overview of the `lv-bootstrap` Feature

## Purpose of the Feature
`lv-bootstrap` generates feature documentation under `docs/features/<feature-id>/` by grounding `overview.md` and `design.md` in the repository code. Doc generation itself now happens through an `lv-bootstrap` skill (and, for known-shape coding agents, a matching slash command) run from inside a coding agent — the agent explores the repo (or reads given paths) and writes the docs directly with its own tools, rather than `lv` driving a separate LLM API call. `lv` itself only handles config/context assembly, the placeholder mode for brand-new features, and post-generation bookkeeping (index update, Lark sync).

## Main Components
- **CLI command**: `bootstrap <feature-id>` is registered in `src/index.ts`, with `--paths`, `--name`, `--description`, `--new-feature`, `--context`, `--finalize`, and `--title` options.
- **Bootstrap runner**: `runBootstrap()` in `src/cli/bootstrap.ts` routes to placeholder mode (`--new-feature`), context mode (`--context`), finalize mode (`--finalize --title <title>`), or a "no flags" error pointing at the `lv-bootstrap` skill.
- **Context assembly**: `runBootstrapContext()` creates the feature directory, reads any existing draft `overview.md`/`design.md`, resolves `scan_extensions`/`scan_skip_dirs`/`output_language` from config, expands `--paths` into a capped repo-relative file list via `expandBootstrapPaths()`/`listCodeFiles()` (from `src/tools/codebase.ts`), and prints one JSON object for the calling skill to consume.
- **Finalize step**: `runBootstrapFinalize()` runs `updateIndex()` and the optional Lark sync once the skill has already written both files itself.
- **lv-bootstrap skill/command**: `LV_BOOTSTRAP_SKILL_BODY` and its per-tool renderers (`buildLvBootstrapSkillFile()`, `buildLvBootstrapClaudeCommandFile()`, `buildLvBootstrapCursorCommandFile()`) in `src/prompts.ts` define the instructions the coding agent follows — get context, explore, refine an existing draft, write the docs, finalize.
- **Skill/command installer**: `installLvBootstrapSkill()` in `src/cli/init.ts` writes the skill (and, for a known command shape) into every coding agent `lv init` detects — see `lv-init` feature docs.
- **Placeholder mode**: `generateFeatureDocsPlaceholder()` writes heading-only `overview.md`/`design.md` for a feature with no code yet — no LLM involvement at all, shared by `--new-feature` and `lv start`'s inline feature bootstrap.
- **Codebase helpers**: `listCodeFiles()` and the `DEFAULT_CODE_EXTENSIONS`/`DEFAULT_SKIP_DIRS` constants in `src/tools/codebase.ts` provide file discovery for `--context`'s `--paths` expansion.
- **Index updater**: `updateIndex()` in `src/cli/bootstrap.ts` maintains `docs/features/INDEX.md`.
- **Optional Lark sync**: `syncNewFeatureToLark()` in `src/cli/bootstrap.ts` can sync generated feature docs to the configured Lark Features table.

## High-level Flow
1. An engineer invokes the `lv-bootstrap` skill/command from their coding agent for a feature ID (optionally with explicit paths, or a name/description hint).
2. The skill runs `lv bootstrap <feature-id> --context [--paths ...] [--name ...] [--description ...]`, which creates the feature directory and prints JSON: repo root, output paths, scan config, output language, any existing draft content, the resolved `paths` list (if given), and the hint.
3. If `paths` is present, the skill reads only those files with its own tools; otherwise it explores the repository freely, using `name`/`description` as a starting hypothesis.
4. If a draft `overview.md`/`design.md` already existed, the skill treats it as something to verify and refine, not copy forward — rewriting any claim about the code from what it observes this run.
5. The skill writes `overview.md` and `design.md` itself, prepending the standard auto-generated header, then runs `lv bootstrap <feature-id> --finalize --title "<title>"`.
6. `--finalize` updates `docs/features/INDEX.md` and, if `lark.features_table_id`/`sync_new_features` are configured, syncs the feature to the Lark Features table.
7. Separately, `lv bootstrap <feature-id> --new-feature` writes placeholder-only docs (no LLM, no exploration) for a feature with no code yet — used directly by an engineer or by `lv start`'s inline feature bootstrap.
8. Running `lv bootstrap <feature-id>` with none of `--new-feature`/`--context`/`--finalize` now exits with an error pointing at the `lv-bootstrap` skill/command instead of attempting any generation itself.

## Constraints and Assumptions
- The command must run from inside a repo containing `.lv.yaml`, because `loadConfig()` and `getRepoRoot()` search upward for that file.
- `--context`'s `paths` field is already expanded from any given directory into a capped file list (50 files per directory) — `lv` never reads file *contents* for the skill, only resolves which files are in scope.
- `--finalize` requires `--title <title>` and expects `overview.md`/`design.md` to already exist at the paths `--context` reported; it does not write or validate their content.
- The `lv-bootstrap` skill/command's own generation instructions live in `LV_BOOTSTRAP_SKILL_BODY` (`src/prompts.ts`) and are identical across every coding agent it's installed for — only the installed file location and frontmatter differ per agent.
- A slash command wrapper only exists for coding agents whose command-file format `lv` has a template for (Claude Code, Cursor, as of this change); every other agent gets the skill only.
- Recursive file collection for `--paths` skips common build and dependency directories (`node_modules`, `.git`, `dist`, `build`, `out`, `__pycache__`, `.venv`, `bin`, `obj`, `.vs`, `packages`, `target`, `vendor`, `.idea`) and matches source files plus several document/config extensions (`md`, `yaml`, `yml`, `json`, `xml`, `config`, `sql`, among others).
- Generated docs are marked as auto-generated and are intended for manual review before commit.
- The feature index update is append-only unless the exact feature link or feature marker already exists.
- Lark sync for generated features only runs when `lark.features_table_id` and `lark.sync_new_features` are enabled and the app credentials are present.

## Current State of the Code
`lv-bootstrap` is implemented as a hybrid of a thin, non-LLM CLI surface (`--context`/`--finalize`/`--new-feature`) and an `lv-bootstrap` skill/command that performs the actual exploration and drafting inside the calling coding agent's own turn — no Mastra agent or separate LLM API call is made by `lv` itself for docs generation anymore. The skill/command is installed automatically by `lv init` for every coding agent it detects OpenSpec was installed for (dynamically, not a hardcoded list), with a slash command additionally written for Claude Code and Cursor. Feature docs are written to `docs/features/<feature-id>/overview.md` and `design.md`, and the feature index is updated automatically. New features can optionally be synced to Lark as part of the bootstrap flow.
