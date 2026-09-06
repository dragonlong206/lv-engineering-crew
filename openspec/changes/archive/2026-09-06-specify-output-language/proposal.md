## Why

LV's target repos are often documented and shipped in a language other than English (the ticket that prompted this change gives Vietnamese as the concrete case). Today nothing tells the coding agent, or LV's own bootstrap agents, what language generated prose should be written in — output language is whatever the underlying LLM defaults to, which is inconsistent and can't be pinned per repo. Engineers need a single, repo-level switch that makes every LLM-generated artifact (OpenSpec proposals/specs/design/tasks written by the coding agent, and `lv bootstrap`'s own `overview.md`/`design.md`) follow one configured language.

## What Changes

- Add an optional `output_language` field to `.lv.yaml` (validated by `ConfigSchema` in `src/types.ts`), e.g. `output_language: "Vietnamese"`. Unset preserves today's behavior (no language constraint).
- `lv init` writes a new line into the OpenSpec `context:` pointer (`CONTEXT_POINTER_LINES` in `src/prompts.ts`) instructing every OpenSpec workflow to check `.lv.yaml` for `output_language` and, when set, write generated artifact prose in that language — headings/identifiers/code/file paths stay as-is, only body prose is translated. This follows the same "point at a file/config key, don't embed the value" approach the existing pointer lines already use, so the instruction never goes stale when the configured language changes.
- `lv bootstrap`'s own agents (the throwaway single-shot `Agent` in `src/cli/bootstrap.ts` and the tool-equipped `createBootstrapScanAgent()` in `src/agents/bootstrap-agent.ts`) also read `config.output_language` and, when set, are told (via `BOOTSTRAP_AGENT_INSTRUCTIONS`/the per-call prompt builders in `src/prompts.ts`) to write `overviewMarkdown`/`designMarkdown` prose in that language.
- No new CLI flags or commands — this is a config-driven behavior change to `lv init` and `lv bootstrap` only.

## Capabilities

### New Capabilities
- `lv-init/output-language`: `lv init` wires the configured `output_language` into the generated OpenSpec `context:` pointer so OpenSpec-driven workflows (propose/apply/sync/archive) write artifact prose in that language.
- `lv-bootstrap/output-language`: `lv bootstrap`'s own LLM agents honor the same `output_language` setting when generating `overview.md`/`design.md` content directly.

### Modified Capabilities
(none — no existing capability's requirements change; `.lv.yaml`/`ConfigSchema` gain a new optional field but that's shared config infrastructure, not a documented capability of its own)

## Impact

- `src/types.ts`: `ConfigSchema` gains `output_language: z.string().optional()`.
- `src/prompts.ts`: new pointer line alongside `CONTEXT_POINTER_LINES`; `BOOTSTRAP_AGENT_INSTRUCTIONS` and `buildBootstrap*Prompt(...)` gain a language-aware section.
- `src/cli/init.ts`: no new write path needed beyond the existing `addContextPointer()` line-presence check (the new line is static text, like the others — it references the config key, not a baked-in value).
- `src/cli/bootstrap.ts`, `src/agents/bootstrap-agent.ts`: read `config.output_language` and pass it through to the prompt builders.
- Backward compatible: repos without `output_language` set see no behavior change.
