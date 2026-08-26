## Context

`startFromTicket` (`src/cli/start.ts`) currently allocates a new feature ID as soon as `ticket.featureIds.length === 0` (via `allocateFeatureIds()` in `src/engine/feature-id.ts`), with no attempt to check whether the change actually belongs to something that already exists. `startFromDescription` never touches `feature_ids` at all — it's always written as `[]`. See proposal.md - Why.

`allocateFeatureIds()` already draws the relevant boundary: it only scans `docs/features/<id>/` directories matching the configured `Fxxxx` pattern, ignoring the kebab-case self-documentation directories (`lv-start`, `lv-init`, ...) this repo also happens to contain for its own CLI commands, per this repo's own "Self-documentation" convention. The match step reuses that same boundary — only `Fxxxx` directories are match candidates.

`lv start` already runs an LLM call in the same flow today: `generateFeatureDocsFromScan()` (owned by `src/cli/bootstrap.ts`, invoked from `start.ts` when a feature ID has no docs yet) uses `getModelForStep(config, "bootstrap")`. The match step is a second, independent LLM call in the same command, not a replacement for that one.

## Goals / Non-Goals

**Goals:**
- Before falling back to "this is a brand-new feature," give the engineer a cheap way to say "actually, this is more of feature X."
- Never allocate an ID or generate docs speculatively — a match only takes effect once the engineer confirms it.

**Non-Goals:**
- Fuzzy-matching or ranking multiple candidates for the engineer to choose from — out of scope per the chosen single-best-guess UX; only one candidate is ever proposed.
- Matching against the kebab-case self-documentation feature directories (`lv-start`, `lv-init`, ...) — out of scope, consistent with `allocateFeatureIds()` already ignoring them.
- Introducing a new `.lv.yaml` model-config key — the match call reuses `models.bootstrap`.

## Decisions

**Candidate list: existing `Fxxxx` directories with non-empty `overview.md`, via a new `listExistingFeatures()` in `src/engine/feature-id.ts`.**
Placed alongside `allocateFeatureIds()` since both walk the same `Fxxxx`-pattern directory listing — reuses the same regex construction instead of duplicating it. A feature directory with no `overview.md`, or an empty one (e.g. `F0001` in this repo today, a leftover from a declined confirm), is excluded: there is no content to compare against, and including it would either crash the prompt-builder or silently degrade the match. If the resulting candidate list is empty, the match step is skipped before any LLM call — no need to ask a model to choose among zero options, and no pointless prompt shown to the engineer (see spec scenario "No existing features have docs yet").

**Matching: one LLM call, strict JSON, reusing `getModelForStep(config, "bootstrap")`.**
Follows this repo's existing convention (`src/prompts.ts`: "Anything asking an LLM to return structured data requests strict JSON with no surrounding text, and is parsed with `extractJson<T>()`"). The prompt (`buildFeatureMatchPrompt()`, added to `src/prompts.ts` alongside the other `build*Prompt` functions) includes the ticket/description title+description and, for each candidate, its ID and `overview.md` content, and asks for `{ "featureId": "<id-or-null>" }`. A throwaway `Agent` instance (same shape as `bootstrapAgent` in `bootstrap.ts` — no memory, no tools) is used rather than the tool-equipped `createBootstrapScanAgent()`, since this call needs one structured answer, not multi-turn exploration. Reusing `models.bootstrap` (rather than adding e.g. `models.match`) keeps `.lv.yaml`'s model-config surface unchanged; this is the same LLM work category (single-shot doc-aware generation) the `bootstrap` step already covers.

**Confirmation: `confirm()`, single yes/no, per the chosen UX.**
`Looks like this matches <id> (<first line of its overview.md, or the id alone if unavailable>). Use it? [y/N]`. Declining is not a hard stop — unlike the existing human-review gate over freshly generated docs (which exits `lv start` entirely on decline), declining a match simply continues into the existing fallback path (allocate new, ticket mode; leave `feature_ids: []`, description mode). No new exit point is introduced.

**Description mode gains matching but not allocation.**
Confirming a match populates `feature_ids: [<id>]` in `state.yaml` for a description-only start, which was previously impossible (always `[]`). Declining leaves it `[]`, exactly as before this change — description-only starts still never allocate a brand-new `Fxxxx` ID, since nothing in the request asked for that and it would be new, unrequested scope (a description-only start may legitimately not correspond to any single feature yet).

## Risks / Trade-offs

- [Model returns a `featureId` that isn't one of the candidates it was given (hallucination)] → Mitigation: validate the returned ID against the candidate list before offering it for confirmation; treat an unrecognized ID the same as "no match found."
- [An extra LLM round-trip adds latency/cost to every `lv start` with an empty Feature ID] → Accepted: skipped entirely when there are no candidates (a fresh repo, or one with only kebab-case self-doc features), and is one small single-shot call, not a multi-turn agent.
