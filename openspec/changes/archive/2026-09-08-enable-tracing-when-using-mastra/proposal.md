## Why

`lv`'s Mastra agents (`bootstrapAgent`, `featureMatchAgent`, `featureSplitAgent`, and `createBootstrapScanAgent()`'s scan agent) run with no observability wired up — the shared `Mastra` instance in `src/mastra.ts` has no `observability` config, and none of the agent-creation sites register their agents with it. There is currently no way to inspect what an agent actually sent to the LLM, which tools it called, or why a run produced a given result, short of ad hoc `console.log`. The engineer needs tracing so LLM calls can be monitored going forward, and it should be configurable (on by default in dev, but toggleable) rather than always-on overhead.

## What Changes

- Add a `tracing` section to `.lv.yaml` (`ConfigSchema` in `src/types.ts`) with an `enabled` boolean (default `true`) controlling whether Mastra observability/tracing is wired up.
- Configure `observability` on the shared `Mastra` instance in `src/mastra.ts` using `@mastra/observability`'s `Observability` class with a `MastraStorageExporter`, so traces are written to the same LibSQL store (`getLvDbPath()`) already used for storage — viewable via `npm run mastra`'s dev server (localhost:4111) without adding a new store or credential.
- Add `@mastra/observability` as a dependency.
- Register every agent created by `lv bootstrap` and `lv start` (`bootstrapAgent`, `featureMatchAgent`, `featureSplitAgent`, `createBootstrapScanAgent()`'s agent) with the shared `mastra` instance so their runs are attributed and traced, instead of being constructed as standalone `Agent` instances disconnected from `src/mastra.ts`.
- When `tracing.enabled` is `false`, agents run exactly as they do today (no observability instance attached, no tracing overhead).

## Capabilities

### New Capabilities
- `mastra-tracing`: configurable Mastra observability/tracing for `lv`'s agents, wired through a shared `Mastra` instance and toggleable via `.lv.yaml`.

### Modified Capabilities
(none — no existing capability's requirements change; this introduces new agent-observability behavior only)

## Impact

- `src/types.ts` — new `tracing` field on `ConfigSchema`.
- `src/mastra.ts` → moved to `src/mastra/index.ts` (required for `mastra dev` to discover the instance — see design.md Decision 5) — adds `observability` config to the shared `Mastra` instance (conditional on `tracing.enabled`).
- `src/agents/bootstrap-agent.ts`, `src/cli/bootstrap.ts`, `src/cli/start.ts` — agents constructed here must be registered with the shared `mastra` instance instead of standalone `new Agent(...)`; import paths for `src/mastra.ts` updated to `src/mastra/index.ts`.
- `package.json` — new dependency `@mastra/observability`.
- `.lv.yaml` (target repos, and this repo's own) — new optional `tracing:` key.
- No breaking changes: `tracing.enabled` defaults to `true`, and omitting the key changes nothing observable to existing `lv bootstrap`/`lv start` output — traces are additive (a new LibSQL table) with no printed output.
