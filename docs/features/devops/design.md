<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# devops

## Architecture and Layers

The implementation is layered around a shared Mastra runtime and the CLI commands that create agents.

- **Configuration layer**: `src/types.ts` defines `ConfigSchema`, including `tracing`, and `src/config.ts` loads and normalizes repository configuration.
- **Mastra runtime layer**: `src/mastra/index.ts` creates the shared `Mastra` instance, the LibSQL storage, and the observability wiring.
- **Agent layer**: `src/agents/bootstrap-agent.ts`, `src/cli/bootstrap.ts`, and `src/cli/start.ts` create agents and register them on the shared Mastra instance.
- **Feature-doc layer**: `docs/features/devops/overview.md` and `docs/features/devops/design.md` describe the feature for human readers and for bootstrap refinement.

## Data Model / Schema

The main schema relevant to this feature is the repository config schema in `src/types.ts`.

- `ConfigSchema.tracing` is optional.
- `TracingConfigSchema` contains `enabled: boolean` with a default of `true`.
- The Mastra runtime uses the LibSQL database path returned by `getLvDbPath()` as its shared storage backend.
- No dedicated feature-specific runtime data model exists for `devops` beyond the shared config and Mastra storage.

## APIs / Interfaces

- `registerAgent<T extends Agent>(agent: T): T` in `src/mastra/index.ts` registers an agent on the shared Mastra instance and returns the registered agent.
- `createBootstrapScanAgent(extensions?, skipDirs?, outputLanguage?)` in `src/agents/bootstrap-agent.ts` builds the scan agent used by bootstrap refinement.
- `runBootstrap(...)` in `src/cli/bootstrap.ts` and `runStart(...)` in `src/cli/start.ts` are the CLI entry points that end up using the shared Mastra agent registration path.
- `Config.tracing.enabled` is the interface used to turn observability on or off.

## Key Design Decisions

- **Single shared Mastra instance**: all `lv`-constructed agents are funneled through one shared instance so tracing is centralized.
- **Boolean-only tracing control**: tracing is intentionally a simple on/off setting rather than a richer exporter configuration.
- **Storage-backed observability**: traces are written through `MastraStorageExporter`, which keeps the setup local and consistent with the existing LibSQL storage.
- **Register-on-construction model**: agents are registered as they are created, so the same code path works for both bootstrap and start flows.
- **Idempotent registration fallback**: `registerAgent()` catches duplicate registration and returns the existing agent, which avoids process-local reruns breaking when the same agent ID is encountered again.
