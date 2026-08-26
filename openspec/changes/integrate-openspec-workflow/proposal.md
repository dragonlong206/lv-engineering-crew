## Why

LV's own `lv start → answer → approve → design → answer → approve` pipeline reimplements spec-authoring machinery — a Mastra `analysisAgent`/`designAgent`, multi-turn Q&A, JSON-parsed document generation — that OpenSpec already does well and that this repo already dogfoods for its own development (`openspec/`, `.claude/skills/openspec-*`, `.claude/commands/opsx/*`). Maintaining a parallel, LV-specific spec pipeline duplicates that machinery for no benefit once OpenSpec can be pointed at the same context (feature docs, ticket data). Standardizing on OpenSpec now — while phase 1 is still small — lets LV shrink to context-plumbing (get the ticket/description into a place OpenSpec can read it) and hand the explore/propose/spec/design/tasks/apply experience to a tool built for exactly that.

## What Changes

- **BREAKING**: `lv answer`, `lv approve`, and `lv design` are removed, along with the Mastra `analysisAgent`/`designAgent` and their dedicated `src/prompts.ts` instructions/prompt builders. OpenSpec's own `/opsx:explore`, `/opsx:propose`, and `/opsx:apply` (or their equivalents for other coding agents) take over spec-authoring; there is no `lv approve` equivalent gating that stage — the engineer reviews and advances using OpenSpec's own workflow directly.
- **BREAKING**: `lv init` is repurposed. It no longer splits raw requirement documents into `Fxxxx` features (`allocateFeatureIds()`'s doc-splitting call site in `src/cli/init.ts` is dropped, not moved elsewhere). Instead, `lv init` installs and configures OpenSpec for a chosen coding agent and wires OpenSpec's generated skills/commands to automatically load LV context.
- `lv init [--tool <tool>]` delegates the actual install to the OpenSpec CLI (`openspec init --tools <tool>`, or an equivalent invocation the design settles on), supporting whatever set of coding agents the installed `openspec` CLI supports — not a hardcoded LV-side list. After install, `lv init` augments the generated skill/command files (or another injection point OpenSpec exposes, e.g. `openspec/config.yaml`'s project `context`) so that OpenSpec's propose/explore/apply flows automatically pull in: (a) the `docs/features/<feature-id>/{overview.md,design.md}` for any feature IDs the current change touches, and (b) the current change's `docs/changes/<change-id>/state.yaml` (ticket fields or free-text description).
- `lv start` gains two entry modes instead of always fetching a Lark ticket:
  - By ticket ID (current behavior, kept): fetch the ticket from Lark Base, create `docs/changes/<ticket-id>/`, and write `state.yaml` with the ticket's fields (title, description, feature IDs) as context for OpenSpec — no analysis document is generated.
  - By free-text description (new): create `docs/changes/<change-id>/` (no Lark fetch) and write a `state.yaml` of the same shape, populated from the given description instead of a fetched ticket.
  - Both modes keep branch creation and the existing `lv-start/inline-feature-bootstrap` / `lv-start/lark-feature-id-sync` behavior for feature IDs; neither produces or commits an analysis document anymore.
- `openspec apply` (run by the engineer through their coding agent) becomes the implementation step. LV does not wrap or gate it — this is where LV's phase-1 scope ends.
- `lv bootstrap` is unchanged: it still populates `docs/features/<feature-id>/{overview.md,design.md}` independent of any ticket.

## Capabilities

### New Capabilities
- `lv-init/openspec-bootstrap`: `lv init` installs/configures OpenSpec for a chosen coding agent (delegating to the OpenSpec CLI's own agent support) and augments its generated skills/commands so OpenSpec workflows automatically load the relevant feature docs and the current change's `state.yaml` context, replacing `lv init`'s prior raw-document feature-splitting role entirely.
- `lv-start/change-context-init`: `lv start`'s two entry modes — by ticket ID or by free-text description — each create `docs/changes/<change-id>/` with a `state.yaml` capturing context (ticket fields or given description) for OpenSpec to consume, replacing analysis-document generation.

### Modified Capabilities
- `lv-start/inline-feature-bootstrap`: the end-of-run commit description changes — it no longer bundles "the branch's analysis document" (removed along with the analysis pipeline) alongside inline-bootstrapped feature docs and the state file.

## Impact

- Removed: `src/cli/answer.ts`, `src/cli/approve.ts`, `src/cli/design.ts`, the `analysisAgent`/`designAgent` definitions under `src/agents/`, their `<X>_AGENT_INSTRUCTIONS`/`build<X>Prompt` entries in `src/prompts.ts`, and their command registrations in `src/index.ts`.
- Rewritten: `src/cli/init.ts` (drop doc-splitting and its `allocateFeatureIds()` call site; add OpenSpec install + skill/command augmentation); `src/cli/start.ts` (drop the analysis-agent invocation and the assumption that an analysis document exists to commit; add the two entry modes and the new `state.yaml` shape).
- `src/types.ts`: `StateSchema` loses the fields tied to the removed analysis/design pipeline (`current_step`, `steps.{analysis,design}.status/iterations/...`) or replaces them with whatever minimal fields the new `state.yaml` needs; `src/engine/state-machine.ts`'s `canRun()` transitions for those steps are removed or substantially simplified.
- `docs/changes/<id>/` no longer holds `1.proposal.md`/`3.design.md`/etc. — those artifacts move to OpenSpec's own `openspec/changes/<id>/` layout, leaving `docs/changes/<id>/state.yaml` as LV's only file there.
- `.lv.yaml`: gains configuration for the OpenSpec install target(s) `lv init` supports.
- `README.md`/`CLAUDE.md`: the two-pipeline architecture description, command wiring table, and related gotchas are rewritten to match.
