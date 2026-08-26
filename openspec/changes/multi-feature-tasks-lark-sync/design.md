## Context

See `proposal.md` for motivation. Two existing code paths are relevant:

- `src/cli/start.ts`'s empty-Feature-ID branch (`featureIds.length === 0`) today allocates exactly one new feature ID via `allocateFeatureIds(repoRoot, 1, ...)` after `matchExistingFeature()` finds no confirmed match. `allocateFeatureIds(repoRoot, count, prefix, digits)` already accepts an arbitrary `count` — no change needed there.
- New-feature docs are written from three call sites: `runBootstrapFromPaths()` and `runBootstrapFromScan()` in `src/cli/bootstrap.ts` (both invoked by `lv bootstrap <feature-id>`), and `lv start`'s inline loop over `missingFeatureIds`. `runBootstrapFromScan()` already computes `alreadyExists = fs.existsSync(.../overview.md)` before generating; `lv start`'s loop already filters to IDs whose directory doesn't exist. `runBootstrapFromPaths()` has no such check today.
- `matchExistingFeature()` (`src/cli/start.ts`) establishes the pattern this design reuses for LLM inference: a throwaway single-shot `Agent` (no memory, no tools), a `build*Prompt()` function in `src/prompts.ts`, and `extractJson<T>()` to parse the strict-JSON response.

## Goals / Non-Goals

**Goals:**
- Let one ticket with no Feature ID introduce more than one new feature, with the engineer confirming the split before anything is allocated.
- Record every newly created feature in a Lark Base Features table, regardless of which command or code path created it.

**Non-Goals:**
- Changing behavior for tickets that already list one or more Feature IDs (existing multi-ID handling in `fetchTicket()`/the missing-feature-dirs loop is untouched).
- Building a full interactive list editor. The confirmation UX is a single accept-or-replace prompt, not per-item add/remove controls.
- Two-way sync (reading Features-table edits back into `docs/features/`). This design only ever writes new records.

## Decisions

**Feature-count inference reuses the throwaway single-shot agent pattern, not the tool-equipped scan agent.** Splitting a ticket's title/description into distinct feature titles is a text-classification task over the ticket's own text, not a codebase-exploration task. A new `buildFeatureSplitPrompt(title, description)` in `src/prompts.ts` asks for strict JSON `{ features: [{ title: string }, ...] }` (minimum one entry), sent through a new agent instance (or the existing `featureMatchAgent`, retargeted) via `.generate()` + `extractJson()`. This keeps the step fast (single call, no tool loop) and consistent with `matchExistingFeature()`'s existing shape. Alternative considered: extend the tool-equipped `createBootstrapScanAgent()` to do the split — rejected, since it would pull in file-reading tools for a task that never needs to look at code.

**Confirmation UX: accept-or-replace, not per-item editing.** After inference, print the numbered list of inferred titles and prompt with a single line via a new `confirmFeatureSplit()` helper in `src/cli/helpers.ts`: pressing Enter accepts the list as-is; typing a comma-separated list of titles replaces it entirely before allocation. This mirrors the existing `confirm()`/`promptSelect()` helpers' minimal-interaction style and sidesteps building a multi-step add/remove UI. The single-feature case (the common path today) still reduces to one Enter press.

**Sync hook is a shared helper called at each of the three generation call sites, not embedded inside `generateFeatureDocsFromScan()`.** `generateFeatureDocsFromScan()` is shared by both `lv bootstrap` and `lv start`, but only `lv start` has ticket context to link back to. A new `syncFeatureToLarkTable(config, larkToken, featureId, title, ticket?)` in `src/tools/lark.ts` takes the ticket reference as an optional parameter and is called:
  - in `runBootstrapFromPaths()`, guarded by an `existsSync` check added before the `mkdirSync` (mirroring `runBootstrapFromScan()`'s existing `alreadyExists` check), with no ticket;
  - in `runBootstrapFromScan()`, guarded by its existing `alreadyExists` check, with no ticket;
  - in `lv start`'s inline loop, for every ID in `missingFeatureIds` (already guaranteed new), with the fetched `ticket`.
  This keeps "is this actually new" detection where it's already computed (or trivially added) rather than threading a `wasNew` flag back out of the shared `generateFeatureDocsFromScan()` return value.

**New config mirrors the existing `lark.sync_feature_id` shape.** `.lv.yaml` gains `lark.features_table_id` (table to write into) and `lark.sync_new_features` (boolean, default `true`), validated in `ConfigSchema` (`src/types.ts`) alongside the existing `lark.*` fields. Field names within the Features table record (feature ID / title / ticket link columns) are hardcoded to sensible defaults for a first pass rather than made individually configurable, consistent with keeping `.lv.yaml` additions minimal — revisit if a real Base's column names force it.

## Risks / Trade-offs

- [Two Lark write-backs now happen for a ticket-triggered new feature — the existing Feature-ID field write-back (`updateTicketFeatureId`) and the new Features-table record — either can fail independently] → Both stay best-effort and non-fatal, matching the existing `lark.sync_feature_id` failure handling; a failure in one is reported but never blocks the other or the rest of `lv start`.
- [LLM-inferred feature counts could over-split a ticket that's really one feature with a long description] → The engineer confirmation step is mandatory before any allocation happens; declining/replacing is as cheap as the existing match-confirmation prompt.
- [`runBootstrapFromPaths()` doesn't currently check for an existing directory before writing, so adding the new-vs-refine check there is new logic, not a reuse of an existing check] → Small, mirrors the check `runBootstrapFromScan()` already has.

## Open Questions

- Exact Features-table column names are a first-pass default (see Decisions); confirming the real Lark Base schema is a task-level detail, not a spec-level one.
