## 1. Config

- [x] 1.1 Add `TracingConfigSchema` (`{ enabled: z.boolean().default(true) }`) to `src/types.ts` and wire `tracing: TracingConfigSchema.optional()` onto `ConfigSchema`; verify with `npx tsc --noEmit`
- [x] 1.2 Add an `isTracingEnabled(config)` helper (`config.tracing?.enabled ?? true`) near `getModelForStep` in `src/config.ts`; verify `loadConfig()` still resolves correctly with no `tracing` key present in `.lv.yaml` (defaults to enabled) and with `tracing: { enabled: false }` set (resolves to disabled)

## 2. Dependency

- [x] 2.1 Add `@mastra/observability` to `package.json` (pinned `"latest"`, matching `@mastra/core`/`@mastra/mcp`) and run `npm install`; verify `node_modules/@mastra/observability` is present and `npx tsc --noEmit` succeeds

## 3. Shared Mastra instance

- [x] 3.1 In `src/mastra.ts`, load config via `loadConfig()` and construct `observability` conditionally on `isTracingEnabled(config)`, using `new Observability({ configs: { default: { serviceName: 'lv', exporters: [new MastraStorageExporter()] } } })` when enabled, `undefined` otherwise; verify `npx tsc --noEmit` and `npm run build` succeed

## 4. Register agents with the shared instance

- [x] 4.1 Update `src/agents/bootstrap-agent.ts`'s `createBootstrapScanAgent()` so its agent is registered with the shared `mastra` instance (imported from `src/mastra.ts`) rather than constructed as a fully standalone `Agent`; verify `lv bootstrap <feature-id>` (autonomous-scan mode, no `--paths`) still completes successfully against a scratch repo
- [x] 4.2 Update `bootstrapAgent` in `src/cli/bootstrap.ts` (the `--paths` single-shot agent) the same way; verify `lv bootstrap <feature-id> --paths <file>` still completes successfully
- [x] 4.3 Update `featureMatchAgent` and `featureSplitAgent` in `src/cli/start.ts` the same way; verify `lv start --description "<text>"` still completes successfully and produces the expected `state.yaml`

## 5. Fix `mastra dev` discovery and verify tracing end-to-end

- [x] 5.1 Discovered `mastra dev` doesn't discover a flat `src/mastra.ts` (fails with "No index.ts and no file-based primitives found"). Move `src/mastra.ts` to `src/mastra/index.ts` via `git mv` (design.md Decision 5), update its `./config.js` import to `../config.js`, and update the three importers (`src/agents/bootstrap-agent.ts`, `src/cli/bootstrap.ts`, `src/cli/start.ts`) from `../mastra.js` to `../mastra/index.js`; verify `npx tsc --noEmit` and `npm run build` succeed
- [x] 5.2 With `tracing` unset (default enabled), run `lv bootstrap <feature-id>`, then `npm run mastra` and confirm the run's trace is visible via the dev server at localhost:4111; verified via `GET /api/observability/traces`, which returned the prior smoke-test run's spans (agent run, model generation, tool calls) including full prompt/instructions content
- [x] 5.3 Set `tracing: { enabled: false }` in a scratch repo's `.lv.yaml`, re-run `lv bootstrap <feature-id>`, and confirm no new trace appears for that run while the command's own output/behavior is unchanged from before this change; verified via span count in the LibSQL store staying constant (53 → 53) across the run
