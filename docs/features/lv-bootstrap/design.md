<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# Design Document for 'lv-bootstrap'

## Architecture and Layers
`lv-bootstrap` is organized as a small CLI entrypoint, a bootstrap runner, an inline generation agent for path-based input, and a tool-equipped scan agent for repo exploration.

- **CLI layer**: `src/index.ts` registers `bootstrap <feature-id>` and forwards `--paths`, `--name`, and `--description` to `runBootstrap()`.
- **Application layer**: `src/cli/bootstrap.ts` loads config, chooses the execution mode, constructs prompts, writes output files, and updates the feature index.
- **Path-based generation layer**: an inline Mastra `Agent` named `lv-bootstrap-agent` generates the docs from a prebuilt code context string.
- **Scan layer**: `createBootstrapScanAgent()` in `src/agents/bootstrap-agent.ts` creates a Mastra `Agent` named `lv-bootstrap-scan-agent` with repository tools attached.
- **Tooling layer**: `src/tools/codebase.ts` exposes reusable file listing, file reading, and code search tools backed by filesystem traversal.
- **Filesystem layer**: generated docs are written under `docs/features/<feature-id>/` and the feature index is maintained in `docs/features/INDEX.md`.

## Data Model / Schema
### Configuration
`loadConfig()` reads `.lv.yaml` and `.lv.local.yaml`, merges them, applies uppercased environment overrides for keys present in local config, validates the merged object with `ConfigSchema`, and publishes string values into `process.env`.

### Path-based code context
The path-based flow constructs a single Markdown string made of repeated sections:

```markdown
### <relative/path>
```
followed by the file contents in a fenced code block.

### Output files
The feature directory contains these files:
- `docs/features/<feature-id>/overview.md`
- `docs/features/<feature-id>/design.md`
- `docs/features/<feature-id>/requirements.md`

### Autonomous scan output
The scan agent must return strict JSON with these keys:
```json
{"overviewMarkdown":"...","designMarkdown":"...","requirementsMarkdown":"..."}
```

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

### Index maintenance interface
- `updateIndex(repoRoot: string, featureId: string): void`
  - Creates `docs/features/INDEX.md` if missing.
  - Appends a link for the feature only if the file does not already contain that feature.

## Key Design Decisions
1. **Two generation strategies**: The command supports both deterministic path-based input and autonomous repo scanning, which makes it useful for both targeted documentation and discovery-driven refinement.
2. **Separate agents for separate jobs**: Path-based generation uses a simple inline agent, while scan mode uses a factory-created agent with tools so it can inspect the repository interactively.
3. **Explicit reuse of draft docs**: Scan mode includes any existing overview, design, or requirements drafts in the prompt so the model can verify and refine them.
4. **Shared output convention**: Both modes write to the same feature directory layout and prepend the same auto-generated header.
5. **Index file maintenance**: `INDEX.md` is updated automatically to keep feature documentation discoverable.
6. **Config-driven model selection**: Both generation paths use `getModelForStep(config, "bootstrap")`, allowing the bootstrap model to be overridden in configuration.