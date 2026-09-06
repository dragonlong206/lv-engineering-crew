## Context

`src/cli/bootstrap.ts` has two generation paths today: `runBootstrapFromPaths()` (dumps `--paths` file contents into an inline agent) and `generateFeatureDocsFromScan()` (tool-equipped agent, `maxSteps: 18`, explores the repo and can refine existing drafts). `src/cli/start.ts:331` calls `generateFeatureDocsFromScan()` directly for any referenced feature ID whose `docs/features/<id>/` directory doesn't exist yet — see `docs/features/lv-start/overview.md` step 6 and the `lv-start/inline-feature-bootstrap` spec's "Missing feature directory" requirement. That call site is inherently the "feature doesn't exist yet" case: there is no code to scan, so the scan agent either explores unrelated code or returns thin/fabricated content. See proposal.md - Why.

## Goals / Non-Goals

**Goals:**
- Give the bootstrap logic a third mode that writes deterministic placeholder content — no LLM call, no repo exploration.
- Make `--new-feature` available directly on `lv bootstrap` for manual use.
- Route `lv start`'s inline-bootstrap call site (missing feature directory) through this mode instead of the scan agent.

**Non-Goals:**
- No change to `--paths` mode or to refining docs for a feature that already has an `overview.md` (that keeps using the scan agent, since there's presumably real code to verify against).
- No change to Lark feature-table sync behavior or timing.
- No interactive confirmation UI beyond what `lv start`'s existing review-gate already provides (see `lv-start/inline-feature-bootstrap`'s "Human review gate" requirement, unchanged).

## Decisions

**New standalone function, not a branch inside `generateFeatureDocsFromScan()`.** Add `generateFeatureDocsPlaceholder(repoRoot, featureId): GeneratedFeatureDocs` alongside `generateFeatureDocsFromScan()` in `src/cli/bootstrap.ts`. It skips `createBootstrapScanAgent()`, `buildBootstrapScanPrompt()`, and `extractJson()` entirely — it just writes a fixed Markdown skeleton (matching the section headings the scan/path prompts already produce: Purpose, Main Components, High-level Flow, Constraints and Assumptions, Current State of the Code for overview; Architecture and Layers, Data Model/Schema, APIs/Interfaces, Key Design Decisions for design) wrapped in `AUTO_GENERATED_HEADER`, then calls `updateIndex()` — matching the other two modes' output shape so `docs/features/INDEX.md` and downstream Lark sync keep working unchanged. Alternative considered: add an `isNewFeature` flag threaded through `generateFeatureDocsFromScan()` that short-circuits before the agent call — rejected because it would leave the scan-prompt-building and JSON-parsing code paths dead for that branch, for no shared logic actually reused.

**`runBootstrap()` gains a `newFeature` option, checked before the `pathsArg` branch.** `src/index.ts`'s `bootstrap` command gets `--new-feature` (boolean, no argument); `runBootstrap(featureId, pathsArg, hint, { newFeature })` calls `generateFeatureDocsPlaceholder()` when `newFeature` is true, printing a warning (matching the existing `--paths`-ignores-hint warning style) if `--paths`/`--name`/`--description` were also passed, since none apply. This is a peer check to the existing `pathsArg ? ... : ...` branch, not a modification of either existing path.

**`lv start`'s call site switches unconditionally, no new flag on `lv start` itself.** `src/cli/start.ts:331` calls `generateFeatureDocsPlaceholder(repoRoot, featureId)` instead of `generateFeatureDocsFromScan(config, repoRoot, featureId, {...})` whenever it takes the "no existing feature directory" branch — this is exactly the case the ticket and the modified spec describe as "a completely new feature," so no additional prompt or flag is needed there; the existing missing-directory check already is the trigger. `hint?.name`/`hint?.description` (ticket title/description) are no longer threaded into doc generation for this call site, since placeholder mode ignores them. This call site's Lark Features-table sync title already came from `newFeatureTitles.get(featureId) ?? ticket.title` (set from the confirmed feature-split step), never from `deriveFeatureTitle()` on generated overview content — so removing the scan call doesn't require any change to title derivation here.

**Placeholder content is static per section list, not templated from `hint`.** Even though `lv start` has the ticket's title/description available, placeholder docs stay content-free (headings only) rather than seeding them with ticket text — the proposal's whole point is "no fabricated/derived content, just structure for the engineer to fill in." Ticket context remains available to the engineer separately via `docs/changes/<change-id>/state.yaml`.

## Risks / Trade-offs

- [Placeholder docs lose the ticket-title-derived Lark sync title that scan mode produced from generated content] → Fall back to `hint?.name` when present (ticket title, already available at the `lv start` call site) and to `featureId` otherwise — same fallback shape `deriveFeatureTitle()` already uses when scan output has no usable first line.
- [A user runs `lv bootstrap --new-feature` on a feature that already has non-empty docs, silently discarding prior content] → Out of scope for this change to guard further: existing `--paths`/scan modes already overwrite `overview.md`/`design.md` unconditionally on every run (scan mode's refinement behavior rewrites the files with agent output, it doesn't merge), so placeholder mode's overwrite is consistent with current bootstrap semantics, not a new risk class.
