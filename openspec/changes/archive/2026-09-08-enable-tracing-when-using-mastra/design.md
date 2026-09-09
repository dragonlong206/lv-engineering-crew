## Context

See proposal.md - Why. Two structural facts shape this design:

- `src/mastra.ts` (pre-change) exports a `mastra` (`Mastra`) instance, but nothing in `src/` imports it — it exists solely for the `mastra` CLI's dev-server discovery convention (`npm run mastra` → `mastra dev`). None of `lv`'s actual `Agent` instances (`bootstrapAgent` in `src/cli/bootstrap.ts`, `featureMatchAgent`/`featureSplitAgent` in `src/cli/start.ts`, or the factory-built agent in `src/agents/bootstrap-agent.ts`) are registered on it — they're standalone `new Agent({...})` calls. So today, even though `npm run mastra` boots a dev server, there is nothing for it to show: no agent is attached to the `mastra` instance and no observability is configured.
- Verified during implementation: the installed `mastra` CLI (v1.27.3) does not actually discover `src/mastra.ts` as a flat file — its default project-scan looks for `src/mastra/index.ts` (a directory), and fails with `No index.ts and no file-based primitives found` against a flat file. This is a pre-existing gap independent of tracing (the dev server has apparently never successfully booted against this repo's current layout), but it blocks verifying traces through `npm run mastra` as this change's spec requires, so fixing it is now in scope here — see Decision 5.
- `@mastra/observability` is not currently a dependency. `@mastra/core`'s `Config.observability` field takes an `ObservabilityEntrypoint` — in practice an instance of `Observability` from `@mastra/observability`, configured with one or more exporters (e.g. `MastraStorageExporter`, which writes to the `Mastra` instance's own `storage`).

## Goals / Non-Goals

**Goals:**
- Wire every `lv`-constructed agent to the shared `mastra` instance so its runs are traced when tracing is enabled.
- Make tracing a single boolean toggle in `.lv.yaml`, default on.
- Reuse the existing LibSQL store (`getLvDbPath()`) as the trace sink — no new service/credential.

**Non-Goals:**
- Exporting traces to an external observability backend (e.g. Langfuse, Braintrust, OTel collector). Only local `MastraStorageExporter` is in scope; a future change can add configurable exporters if needed.
- Tracing anything outside Mastra agent runs (e.g. git/Lark API calls, CLI command timing).
- Per-agent tracing toggles — the `tracing.enabled` flag is global for this change.

## Decisions

**1. `tracing.enabled: boolean` (default `true`), not a richer `tracing:` object with exporter choices.**
The proposal only asks for an on/off switch ("enable tracing... so I can monitor the LLM calls later"). A single boolean keeps `.lv.yaml` simple and matches the existing style of other boolean toggles in `ConfigSchema`/`LarkConfigSchema` (e.g. `sync_status`, `sync_feature_id`). Add as:
```ts
export const TracingConfigSchema = z.object({
  enabled: z.boolean().default(true),
});
// on ConfigSchema:
tracing: TracingConfigSchema.optional(),
```
Read via a small helper (mirroring `getModelForStep`), e.g. `isTracingEnabled(config) => config.tracing?.enabled ?? true`, called once from `src/mastra/index.ts`.

**2. Configure `observability` on the single shared `mastra` instance in `src/mastra/index.ts`, and have every agent-creation site pull its `Agent` through that instance rather than constructing standalone `Agent`s.**
Alternative considered: give each of the three call sites (`bootstrap.ts`, `start.ts`, `bootstrap-agent.ts`) its own local `Observability` instance. Rejected — that would duplicate exporter wiring three times and produce three separate trace namespaces instead of one coherent view in the `npm run mastra` dev server, defeating "inspect agent traces" as a single place to look. Centralizing in `src/mastra/index.ts` also matches its existing role as the dev-server's discovery point.
Concretely: `src/mastra/index.ts` loads config (`loadConfig()`) and constructs the `Mastra` instance with:
```ts
observability: isTracingEnabled(config)
  ? new Observability({ configs: { default: { serviceName: 'lv', exporters: [new MastraStorageExporter()] } } })
  : undefined,
```
Each agent-creation site (`bootstrapAgent`, `featureMatchAgent`, `featureSplitAgent`, `createBootstrapScanAgent()`) registers its agent with this `mastra` instance via `mastra.addAgent(agent)` (a `registerAgent()` helper exported alongside `mastra`, falling back to `mastra.getAgentById()` if a duplicate key was already added in-process — `createBootstrapScanAgent()` is a factory that can be called more than once per process) instead of being used standalone — so a run through any of them participates in that instance's observability when configured, and behaves exactly as today when it isn't.
Note: agent registration happens in the CLI process that runs `lv bootstrap`/`lv start`, not in the separate `mastra dev` process — so `mastra dev`'s Studio "Agents" list stays empty (registration is in-memory, per-process). This is fine for this change's goal: traces are what needs to be visible, and those are persisted to the shared LibSQL file both processes read/write, independent of in-memory agent registration.

**3. Trace sink is `MastraStorageExporter` against the existing LibSQL store, not a second store or an external exporter.**
`getLvDbPath()`'s LibSQL file already backs Mastra's storage for `lv bootstrap`'s agents; reusing it for traces means `tracing.enabled: true` requires no new file, credential, or network dependency, and traces are visible in the same `npm run mastra` dev server the CLAUDE.md commands table already documents for "inspect agent traces/tool calls" — that phrase describes the intended end state this change delivers, not existing behavior. Verified directly: `GET /api/observability/traces` on the running dev server returns spans written by a separate `lv start`/`lv bootstrap` process, reading the same LibSQL file.

**4. `tracing.enabled` is read once per CLI invocation in `src/mastra/index.ts`, not re-checked per agent run.**
Consistent with how `loadConfig()` is otherwise consumed (`getModelForStep`, Lark config) — one config load per process, no runtime toggling mid-run.

**5. Move `src/mastra.ts` to `src/mastra/index.ts` so `mastra dev` actually discovers the instance.**
Discovered during implementation (see Context): the installed `mastra` CLI's default project-scan requires a `src/mastra/index.ts` directory-style entry, not a flat `src/mastra.ts` file — with the flat file, `mastra dev` fails outright (`No index.ts and no file-based primitives found`), regardless of tracing. Since this change's spec requires traces to be "viewable through the existing `npm run mastra` dev server," and that command didn't actually work before this change either, fixing the file layout is in scope here rather than deferred. Alternative considered: keep `src/mastra.ts` and pass `mastra dev -d src`, pointing the CLI at the `src/` directory — rejected because that convention instead expects a `mastra` binding exported from `src/index.ts` (this repo's actual CLI entrypoint, a Commander program), which would mean exporting a Mastra instance from the CLI's own entrypoint module — a bigger and more surprising change than moving one file. All three importers (`src/agents/bootstrap-agent.ts`, `src/cli/bootstrap.ts`, `src/cli/start.ts`) updated their import path from `../mastra.js` to `../mastra/index.js` accordingly; `src/mastra/index.ts`'s own `./config.js` import became `../config.js`.

## Risks / Trade-offs

- [Registering agents on the shared `mastra` instance changes their construction shape (from standalone `new Agent()` to instance-registered agents), which touches four call sites] → Mitigate by keeping each agent's own config (instructions, model, tools) unchanged — only *how* it's attached to `mastra` changes, not its behavior when tracing is disabled.
- [`@mastra/observability` is a new dependency, `"latest"`-pinned like this repo's other `@mastra/*` packages] → Accept, consistent with existing dependency pinning style in `package.json`.
- [`MastraStorageExporter` writes trace spans to the same LibSQL file used for other Mastra storage — file growth over time with heavy bootstrap/start usage] → Not mitigated in this change (no retention policy); acceptable since this is a local dev-only file (`getLvDbPath()`), not shared/production infra. Flagged as a future cleanup if it becomes a problem.
- [Moving `src/mastra.ts` → `src/mastra/index.ts` changes every import site's relative path] → Low risk: only three importers exist (`bootstrap-agent.ts`, `bootstrap.ts`, `start.ts`), all updated in the same commit and covered by `npx tsc --noEmit`/`npm run build`; `git mv` preserves file history.
