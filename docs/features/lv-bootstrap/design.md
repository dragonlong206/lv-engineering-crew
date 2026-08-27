<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# Design Document for `lv-bootstrap`

## Architecture and Layers
`lv-bootstrap` is organized as a CLI entrypoint, a bootstrap runner, an inline generation agent for path-based input, a tool-equipped scan agent for repo exploration, and an optional Lark sync step.

- **CLI layer**: `src/index.ts` registers `bootstrap <feature-id>` and forwards `--paths`, `--name`, and `--description` to `runBootstrap()`.
- **Application layer**: `src/cli/bootstrap.ts` loads config, chooses the execution mode, constructs prompts, writes output files, updates the feature index, and can sync a new feature to Lark.
- **Path-based generation layer**: an inline Mastra `Agent` named `lv-bootstrap-agent` generates the docs from a prebuilt code context string.
- **Scan layer**: `createBootstrapScanAgent()` in `src/agents/bootstrap-agent.ts` creates a Mastra `Agent` named `lv-bootstrap-scan-agent` with repository tools attached.
- **Tooling layer**: `src/tools/codebase.ts` exposes reusable file listing, file reading, and code search tools backed by filesystem traversal.
- **Filesystem layer**: generated docs are written under `docs/features/<feature-id>/`, and the feature index is maintained in `docs/features/INDEX.md`.
- **Integration layer**: `syncNewFeatureToLark()` uses the Lark client helpers in `src/tools/lark.ts` when feature-table sync is enabled.

## Data Model / Schema
### Configuration
`loadConfig()` reads `.lv.yaml` and `.lv.local.yaml`, merges them, applies uppercased environment overrides for keys present in local config, validates the merged object with `ConfigSchema`, and publishes string values into `process.env`.

### Path-based code context
The path-based flow constructs a single Markdown string made of repeated sections:

```markdown
### <relative/path>
```
followed by the file contents in a fenced code block.

### Autonomous scan prompt inputs
The scan prompt is built from:
- the feature ID
- the repository root path
- any existing `overview.md`
- any existing `design.md`
- optional name and description hints

### Output files
The feature directory contains these files:
- `docs/features/<feature-id>/overview.md`
- `docs/features/<feature-id>/design.md`

### Autonomous scan output
The scan agent must return strict JSON with these keys:
```json
{"overviewMarkdown":"...","designMarkdown":"..."}
```

### Lark sync condition
A feature is synced only when the configuration enables it and the required Lark credentials are present. The sync uses the generated overview text to derive a title when no explicit hint name is available.

## APIs / Interfaces
### Public command interface
- `bootstrap <feature-id>`
- Options:
  - `--paths <paths>`: comma-separated repo-relative or absolute file or directory paths
  - `--name <name>`: optional feature name hint for autonomous scan mode only
  - `--description <description>`: optional feature description hint for autonomous scan mode only

### Runner interface
- `runBootstrap(featureId: string, pathsArg?: string, hint?: BootstrapScanHint): Promise<void>`
  - Routes to path-based generation when `pathsArg` is provided, otherwise to autonomous scan mode.

### Autonomous scan helper
- `generateFeatureDocsFromScan(config: Config, repoRoot: string, featureId: string, hint?: BootstrapScanHint): Promise<GeneratedFeatureDocs>`
  - Performs the autonomous scan flow without CLI printing.
  - Returns the feature directory plus the written overview and design paths.

### Index maintenance interface
- `updateIndex(repoRoot: string, featureId: string): void`
  - Creates `docs/features/INDEX.md` if missing.
  - Appends a link for the feature only if the file does not already contain that feature link.

## Key Design Decisions
1. **Two generation strategies**: The command supports both deterministic path-based input and autonomous repo scanning, which makes it useful for both targeted documentation and discovery-driven refinement.
2. **Separate agents for separate jobs**: Path-based generation uses a simple inline agent, while scan mode uses a factory-created agent with tools so it can inspect the repository interactively.
3. **Explicit reuse of draft docs**: Scan mode includes any existing overview or design drafts in the prompt so the model can verify and refine them.
4. **Shared output convention**: Both modes write to the same feature directory layout and prepend the same auto-generated header.
5. **Index file maintenance**: `INDEX.md` is updated automatically to keep feature documentation discoverable.
6. **Config-driven model selection**: Both generation paths use `getModelForStep(config, "bootstrap")`, allowing the bootstrap model to be overridden in configuration.
7. **Tool limits are encapsulated in the tooling layer**: code discovery is restricted by configured extension and skip-directory lists, and search results are capped to keep exploration bounded.
8. **Optional downstream sync is isolated**: Lark table synchronization is only attempted after a new feature is generated, and only when the relevant feature-table and credential settings are present.