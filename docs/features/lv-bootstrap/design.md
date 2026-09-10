<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# Design Document for `lv-bootstrap`

## Architecture and Layers
`lv-bootstrap` is organized as a CLI entrypoint, a bootstrap runner with three non-LLM modes, a shared skill/command body and its per-tool renderers, a skill/command installer, reusable codebase helpers, and an optional Lark sync step. No part of this feature drives its own Mastra `Agent`/LLM API call anymore — that work moved into the calling coding agent's own turn.

- **CLI layer**: `src/index.ts` registers `bootstrap <feature-id>` and forwards `--paths`, `--name`, `--description`, `--new-feature`, `--context`, `--finalize`, and `--title` to `runBootstrap()`.
- **Application layer**: `src/cli/bootstrap.ts` loads config, routes to placeholder/context/finalize mode (or errors on no flags), assembles the context JSON, updates the feature index, and can sync a generated feature to Lark.
- **Placeholder layer**: `generateFeatureDocsPlaceholder()` writes heading-only docs for features that do not yet have code — unchanged by this feature's conversion, since it never called an LLM.
- **Skill/command content layer**: `LV_BOOTSTRAP_SKILL_BODY` (`src/prompts.ts`) is the single instructional body shared verbatim by every coding agent's `SKILL.md` and command file; `buildLvBootstrapSkillFile()`, `buildLvBootstrapClaudeCommandFile()`, and `buildLvBootstrapCursorCommandFile()` wrap it with each file's own frontmatter.
- **Skill/command install layer**: `installLvBootstrapSkill()` (`src/cli/init.ts`) detects every coding agent OpenSpec installed a skill for and writes the `lv-bootstrap` skill (and, for a known command shape, a command file) into each one.
- **Tooling layer**: `src/tools/codebase.ts` exposes `listCodeFiles()` and the `DEFAULT_CODE_EXTENSIONS`/`DEFAULT_SKIP_DIRS` constants, used only by `--context`'s `--paths` expansion now (the Mastra tool wrappers that used to back an autonomous scan agent were removed).
- **Filesystem layer**: generated docs are written under `docs/features/<feature-id>/`, and the feature index is maintained in `docs/features/INDEX.md`.
- **Integration layer**: `syncNewFeatureToLark()` uses the Lark client helpers in `src/tools/lark.ts` when feature-table sync is enabled.

## Data Model / Schema
### Configuration
`loadConfig()` reads `.lv.yaml` and `.lv.local.yaml`, merges them, applies uppercased environment overrides for keys present in local config, validates the merged object with `ConfigSchema`, and publishes string values into `process.env`. `models.bootstrap` remains in the schema but is no longer read by this feature — `getModelForStep(config, "bootstrap")` is still called elsewhere (`lv start`'s feature-match/split agents reuse that same config key for their own model selection).

### `--context` output (no LLM call)
`runBootstrapContext()` prints a single JSON object:
```json
{
  "repoRoot": "...",
  "overviewPath": "...",
  "designPath": "...",
  "scanExtensions": ["..."],
  "scanSkipDirs": ["..."],
  "outputLanguage": "... (omitted if unset)",
  "existingOverviewMarkdown": "... (omitted if no draft)",
  "existingDesignMarkdown": "... (omitted if no draft)",
  "paths": ["... (omitted unless --paths given)"],
  "name": "... (omitted unless given)",
  "description": "... (omitted unless given)"
}
```
`paths`, when present, is already expanded from any given directory into a capped file list (50 files per directory) via `expandBootstrapPaths()`/`listCodeFiles()` — file *contents* are not included; the calling skill reads them itself.

### `--finalize` inputs
Takes `<feature-id>` and `--title <title>`; assumes `overview.md`/`design.md` already exist at the paths `--context` reported. No content is read or validated beyond an existence check.

### Placeholder output files
The placeholder mode writes two Markdown files with section headings and TODO markers:
- `docs/features/<feature-id>/overview.md`
- `docs/features/<feature-id>/design.md`

### Skill/command frontmatter shapes
- **Skill (`SKILL.md`)**: identical for every coding agent — `name: lv-bootstrap`, a shared description, `allowed-tools: Bash(lv bootstrap:*)`, `metadata.author: lv`.
- **Claude command** (`.claude/commands/lv/bootstrap.md`): `name: "LV: Bootstrap"`, same `allowed-tools`.
- **Cursor command** (`.cursor/commands/lv-bootstrap.md`): `name: "/lv-bootstrap"`, `id: "lv-bootstrap"`, `category: "Workflow"`, no `allowed-tools` field.
- Every other coding agent gets the skill only — no command file, since `lv` has no template for that agent's command-file format yet.

### Lark sync condition
A feature is synced only when the configuration enables it and the required Lark credentials are present. `--finalize`'s `--title` argument (derived by the skill from the overview it just wrote) is used as the record's title.

## APIs / Interfaces
### Public command interface
- `bootstrap <feature-id>`
- Options:
  - `--paths <paths>`: comma-separated repo-relative or absolute file/directory paths, for `--context` to scope exploration to
  - `--name <name>` / `--description <description>`: optional feature hints, for `--context`
  - `--new-feature`: write placeholder-only docs without scanning code
  - `--context`: print JSON context for the `lv-bootstrap` skill/command (no LLM call)
  - `--finalize`: update the feature index and sync Lark once the skill has written the docs (no LLM call; requires `--title`)
  - `--title <title>`: feature title, used with `--finalize`

### Runner interface
- `runBootstrap(featureId: string, pathsArg?: string, hint?: BootstrapScanHint, opts?: BootstrapOpts): Promise<void>`
  - Routes to placeholder mode when `opts?.newFeature` is set.
  - Routes to context mode when `opts?.context` is set.
  - Routes to finalize mode (requiring `opts?.title`) when `opts?.finalize` is set.
  - Otherwise exits with an error pointing at the `lv-bootstrap` skill/command.

### Placeholder helper
- `generateFeatureDocsPlaceholder(repoRoot: string, featureId: string): GeneratedFeatureDocs`
  - Creates the feature directory and writes heading-only docs.

### Index maintenance interface
- `updateIndex(repoRoot: string, featureId: string): void`
  - Creates `docs/features/INDEX.md` if missing.
  - Appends a link for the feature only if the file does not already contain that feature link or marker.

### Skill/command content interface
- `LV_BOOTSTRAP_SKILL_BODY: string` — the shared instructional body.
- `buildLvBootstrapSkillFile(): string`, `buildLvBootstrapClaudeCommandFile(): string`, `buildLvBootstrapCursorCommandFile(): string` — render a full file (frontmatter + body) for their respective install target.

### Skill/command install interface
- `installLvBootstrapSkill(repoRoot: string): void` (`src/cli/init.ts`) — detects every coding agent OpenSpec installed a skill for (by checking each of `repoRoot`'s own subdirectories for `skills/openspec-propose/SKILL.md`) and writes the `lv-bootstrap` skill there, plus a command file for a known shape (currently Claude, Cursor).

## Key Design Decisions
1. **Generation moved into the calling coding agent's own turn**: the two LLM-driven modes (autonomous scan, `--paths`-based) are replaced by an `lv-bootstrap` skill/command that explores and writes the docs itself, eliminating a second billed LLM call for work the calling agent can already do.
2. **`lv` keeps only what needs to stay in TypeScript**: config/`.lv.yaml` parsing, `--paths` expansion, the feature directory/index bookkeeping, and Lark's REST protocol stay in `bootstrap.ts` behind `--context`/`--finalize`; everything else (exploration, drafting, refining) is the skill's job.
3. **Dynamic tool detection, not a hardcoded list**: `installLvBootstrapSkill()` finds every coding agent OpenSpec installed a skill for by checking for `skills/openspec-propose/SKILL.md` under each of the repo root's subdirectories — the same tool-agnostic philosophy `lv init` already applies to installing OpenSpec itself.
4. **A small, separate table for command shapes**: unlike the skill (universal across tools), a slash-command wrapper's file format varies too much to generalize (nested vs. flat Markdown, a separate `workflows/` dir, TOML for some tools) — `lv` only authors templates for shapes it explicitly knows (Claude, Cursor), leaving every other tool skill-only.
5. **Draft docs are still reused**: the skill is instructed to verify and refine an existing draft rather than blindly restate or discard it, carrying forward the same semantics the old autonomous-scan agent had.
6. **Shared output convention preserved**: every mode still writes to the same feature directory layout and prepends the same auto-generated header.
7. **Placeholder mode is untouched**: it never called an LLM, so it keeps working exactly as before, including as `lv start`'s inline feature bootstrap.
