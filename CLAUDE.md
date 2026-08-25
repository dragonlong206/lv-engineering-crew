# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install              # install deps (npm is canonical — package-lock.json is committed; bun.lock is gitignored)
npm run build             # tsup src/index.ts -> dist/ (ESM + .d.ts)
npm run dev -- <args>      # run the CLI from source via tsx, e.g. `npm run dev -- bootstrap F0001`
npm link                  # after building, installs the `lv` binary globally from dist/index.js
npm run mastra             # Mastra dev server at localhost:4111 — inspect agent traces/tool calls
npx tsc --noEmit           # type-check
```

There is no lint script and no automated test suite. Verify changes with `tsc --noEmit`, `npm run build`, and by actually running the relevant `lv <subcommand>` against a scratch repo/doc (see any `src/cli/*.ts` for the command it implements).

## Architecture

`lv` is a spec-driven-development CLI with two independent pipelines that both write into `docs/` of the *target* repo (this repo dogfoods itself — see below).

**1. Ticket pipeline** — `lv start <ticket-id>` → `lv answer` → `lv approve` → `lv design` → `lv answer` → `lv approve`. Tracks progress in `docs/changes/<ticket-id>/state.yaml` (schema: `StateSchema` in `src/types.ts`), which is the single source of truth for workflow state — not LibSQL, which only holds Mastra's own thread/memory internals. `src/engine/state-machine.ts`'s `StateMachine.canRun(command)` enforces valid transitions between `current_step` (`analysis`|`design`) and each step's `status` (`pending`|`in_progress`|`approved`). Every command after `start` re-derives the ticket ID from the current git branch (`lv/<ticket-id>`) rather than taking it as an argument — see the `currentBranch()` + strip-`lv/`-prefix pattern repeated in `src/cli/answer.ts`, `approve.ts`, `design.ts`, `status.ts`.

**2. Feature docs pipeline** — `lv init <doc-paths...>` → `lv bootstrap <feature-id>`. Populates `docs/features/<feature-id>/{overview.md,design.md}`, independent of any ticket. `lv init` splits raw requirement documents (md/txt/pdf/docx/html, or a URL recorded as an unfetched reference) into features and allocates `Fxxxx`-style IDs (`src/engine/feature-id.ts`, scans existing `docs/features/` dirs for the highest matching ID and continues from there). `lv bootstrap` fills in a feature's docs either from explicit `--paths` (single-shot: dumps matching files into one prompt) or, when `--paths` is omitted, via autonomous codebase exploration — a tool-equipped agent that reads any existing draft and *refines* it (re-verifying code facts against fresh exploration) rather than overwriting from scratch. A `lv start` ticket requires every referenced feature ID to already have a `docs/features/<id>/` directory — `lv bootstrap`/`lv init` are how that gets created first.

**Command wiring**: every command in `src/index.ts` is `program.command(...).action(async (...) => { const {runX} = await import('./cli/x.js'); await runX(...).catch(die) })` — a lazy dynamic import per command so CLI startup doesn't eagerly load Mastra/agents. Each `src/cli/x.ts` exports one `runX(...)` doing all the work — no separate controller/service abstraction. Follow this exact shape for new commands.

**Config** (`src/config.ts`): `loadConfig()` walks up from cwd for `.lv.yaml` (repo root marker), merges `.lv.yaml` (committed) + `.lv.local.yaml` (gitignored secrets) + matching uppercased env vars (highest priority), validated by the zod `ConfigSchema` in `src/types.ts`. Every string config value is auto-bridged into `process.env[KEY.toUpperCase()]` so Mastra provider SDKs pick up credentials without extra wiring — this is why `.lv.local.yaml` keys must be named exactly like the env var, lowercased (`openai_api_key` → `OPENAI_API_KEY`).

**Model selection**: models are Mastra `"provider/model"` strings (e.g. `openai/gpt-4o`). `getModelForStep(config, step)` resolves `config.models?.[step] ?? config.model` — override per pipeline step (`analysis`/`design`/`bootstrap`/`init`) under `.lv.yaml`'s `models:` key.

**Agents** (`src/agents/`) come in three flavors:
- **Persistent, memory-backed** (`analysisAgent`, `designAgent`) — Mastra `Agent` with LibSQL thread memory (`~/.config/lv/lv.db`) so multi-turn `lv answer` iterations remember prior conversation, plus read-only tools (`readFeatureDocs`, `getRecentDocChanges`, `readDocFile` from `src/tools/`) so the agent pulls its own context instead of being handed a pre-built prompt.
- **Throwaway single-shot** (inline `Agent` in `src/cli/bootstrap.ts` and `src/cli/init.ts`) — no memory, no tools, used for one-off `generate()` calls where the full context is dumped straight into the prompt.
- **Stateless but tool-equipped** (`createBootstrapScanAgent()` in `src/agents/bootstrap-agent.ts`) — a factory, not a singleton, because its `listFiles`/`readFile`/`searchCode` tools (`buildCodebaseTools()` in `src/tools/codebase.ts`) close over the target repo's `scan_extensions`/`scan_skip_dirs` (from `.lv.yaml`, defaulting to `DEFAULT_CODE_EXTENSIONS`/`DEFAULT_SKIP_DIRS`), so a fresh agent instance is built per `lv bootstrap` run. No memory, but multi-turn tool-calling to explore the repo. **Gotcha**: Mastra's `Agent.generate()` defaults to `maxSteps: 5` — an exploration agent that needs more turns silently stops with empty `text` and `finishReason: 'tool-calls'` unless you pass a higher `maxSteps` explicitly at the call site.

**Prompts** are centralized in `src/prompts.ts`, not scattered per-agent: one `<X>_AGENT_INSTRUCTIONS` constant (the Mastra system prompt) per persistent/tool-equipped agent, and `build<X>Prompt(...)` functions building the per-call user message. Anything asking an LLM to return structured data requests strict JSON with no surrounding text, and is parsed with `extractJson<T>()` (`src/cli/helpers.ts`), which strips a stray ` ```json`/` ```markdown ` fence before `JSON.parse` — models sometimes wrap "no fences" JSON in fences anyway.

**Git integration** (`src/integrations/git/client.ts`) wraps `execa('git', ...)`. `commitAll()` is stage-all + conditional commit (no-op if nothing changed) and runs after every state-mutating ticket-pipeline command instead of granular `git add`. Only `lv start` also pushes (non-fatal — warns and stays local-only if push fails, e.g. no remote/network). `lv bootstrap`/`lv init` deliberately do **not** commit — they print "review, edit, then commit manually" since generated docs are unverified (headed with an `AUTO_GENERATED_HEADER` comment).

**Lark Base** (`src/tools/lark.ts`) is the only ticket source. `lv start` fetches a ticket record via the Lark Bitable REST API and reads the Feature ID column (name configurable via `.lv.yaml`'s `lark.feature_id_field`).

**Self-documentation**: this repo dogfoods its own `docs/features/` convention for its own CLI commands — directories named after the command (`lv-start`, `lv-bootstrap`, `lv-init`, ...), separate from the `Fxxxx`-style IDs `lv init` allocates for real product features (those don't match the kebab-case pattern so ID allocation ignores them). `docs/features/INDEX.md` is a hand-maintained markdown table; `updateIndex()` (`src/cli/bootstrap.ts`) appends a fallback bullet line only if no `[<id>]` link already exists anywhere in the file.
