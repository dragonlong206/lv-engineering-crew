<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# Design Document for 'lv-bootstrap'

## Architecture and Layers
`lv-bootstrap` is split into a thin CLI entrypoint, a bootstrap runner, and two AI-driven generation paths.

- **CLI layer**: `src/index.ts` registers the `bootstrap` command and forwards `feature-id`, `--paths`, `--name`, and `--description` into `runBootstrap()`.
- **Application layer**: `src/cli/bootstrap.ts` handles configuration loading, branching between path-based and autonomous scan flows, prompt construction, output writing, and index maintenance.
- **Agent layer**: `bootstrapAgent` generates docs from a supplied code block, while `bootstrapScanAgent` can inspect the repository using tools and produce finalized docs in JSON form.
- **Tooling layer**: `src/tools/codebase.ts` provides reusable file discovery and search tools for both the command path and the autonomous agent.
- **Filesystem layer**: The command reads repo files directly and writes docs under `docs/features/<feature-id>/`.

## Data Model / Schema
### Configuration
`loadConfig()` reads `.lv.yaml` and `.lv.local.yaml`, merges them, applies environment overrides derived from uppercased keys, validates the result with `ConfigSchema`, and publishes string values into `process.env`.

### Code context format
Path-based generation builds a single Markdown string with repeated sections of the form:

```markdown
### <relative/path>
``` 

followed by the file contents inside a fenced code block.

### Output files
- `docs/features/<feature-id>/overview.md`
- `docs/features/<feature-id>/design.md`
- `docs/features/INDEX.md`

### Autonomous scan output
The scan agent is expected to return JSON matching:
```json
{"overviewMarkdown":"...","designMarkdown":"..."}
```

## APIs / Interfaces
### Public command interface
- `bootstrap <feature-id>`
- Options:
  - `--paths <paths>`: comma-separated repo-relative or absolute file or directory paths
  - `--name <name>`: optional feature name hint for autonomous mode only
  - `--description <description>`: optional feature description hint for autonomous mode only

### Core function
- `runBootstrap(featureId: string, pathsArg?: string, hint?: BootstrapScanHint): Promise<void>`
  - Routes to either `runBootstrapFromPaths()` or `runBootstrapFromScan()`.

### Internal helper interface
- `updateIndex(repoRoot: string, featureId: string): void`
  - Creates `docs/features/INDEX.md` if missing and otherwise appends the feature link only if it is not already present.

## Key Design Decisions
1. **Two generation strategies**: The command supports both deterministic path-based input and autonomous repo scanning, which makes it useful both for targeted documentation work and for feature discovery.
2. **Separate prompts for overview and design**: Path-based mode generates each document independently, allowing the model to focus on the requested document shape.
3. **Tool-based autonomous refinement**: Autonomous mode uses `listFiles`, `readFile`, and `searchCode` tools so the model can inspect the repository before writing JSON output.
4. **Shared output convention**: Both modes write to the same feature directory layout under `docs/features`, with a standardized auto-generated header.
5. **Index file maintenance**: `INDEX.md` is updated automatically to keep feature documentation discoverable.
6. **Config-driven model selection**: The bootstrap step uses `getModelForStep(config, "bootstrap")`, so the configured bootstrap model can override the default model defined on the agent.