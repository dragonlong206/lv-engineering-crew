## Why

`lv start`'s existing-feature match step (`matchExistingFeature()` in `src/cli/start.ts`) only ever asks the LLM for a single `featureId` and only ever offers the engineer one candidate to accept or decline. When a ticket or description genuinely spans more than one existing feature — a common case per `docs/features/lv-start/overview.md`'s own note that "a task can relate to multiple features" — the engineer either gets a single (often first-guess) match, or none at all, and has to manually add the rest to `feature_ids` in `state.yaml` afterward. `lv start` already builds a full list of candidate features with docs; it should let the model return more than one and let the engineer confirm which of them actually apply, the same way it already lets the engineer confirm/edit an inferred split of *new* features (`confirmFeatureSplit()`).

## What Changes

- `matchExistingFeature()` (and its LLM call via `buildFeatureMatchPrompt()`) returns zero, one, or several candidate existing features instead of at most one — the model is asked to list every existing feature the change is clearly more work on, not just the single best guess.
- The engineer is shown all matched candidates together and can accept some, all, or none of them (a multi-select confirmation, following the existing `confirmFeatureSplit()` pattern rather than a single `[y/N]` prompt).
- If the engineer accepts one or more matches, all accepted feature IDs are used as-is (added to `feature_ids`, no new IDs allocated, no docs regenerated) — same as today's single-match accept, just supporting more than one ID. If the engineer accepts none of the candidates, behavior is unchanged: ticket-based starts fall back to inferring and allocating new feature(s) via `inferFeatureSplit()`; description-based starts leave `feature_ids` empty.
- If no existing features have docs yet, or the model finds no plausible candidates, behavior is unchanged (silent skip / no candidates to confirm).
- Applies to both `lv start <ticket-id>` and `lv start --description "..."`, matching the two call sites `matchExistingFeature()` already has.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `lv-start/inline-feature-bootstrap`: the existing-feature match step can surface and let the engineer confirm multiple matched features instead of at most one.

## Impact

- `src/cli/start.ts`: `matchExistingFeature()` return type changes from `ExistingFeature | undefined` to an array; both `startFromTicket` and `startFromDescription` change their confirm-and-use logic from a single `[y/N]` prompt to a multi-select confirmation, and `startFromTicket`'s "no match → infer new features" fallback now applies only to the unmatched remainder.
- `src/prompts.ts`: `buildFeatureMatchPrompt()`'s requested JSON shape changes from a single nullable `featureId` to a list of feature IDs.
- `src/cli/helpers.ts`: a new multi-select confirmation helper for existing-feature matches (parallel to `confirmFeatureSplit()`), or `confirmFeatureSplit()`'s prompt pattern is generalized to cover both cases.
- No change to `docs/features/<id>/` generation, feature ID allocation, or the human review gate for newly generated docs.
