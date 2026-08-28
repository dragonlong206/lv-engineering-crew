## Context

`matchExistingFeature()` in `src/cli/start.ts` currently asks `featureMatchAgent` for a single nullable `featureId` (via `buildFeatureMatchPrompt()` in `src/prompts.ts`) and, if present, shows one `[y/N]` `confirm()` prompt at each of its two call sites (`startFromTicket`, `startFromDescription`). A separate, unrelated flow — `inferFeatureSplit()` / `confirmFeatureSplit()` — already asks the engineer to review and edit a *list* of inferred **new** feature titles via a numbered list + "press Enter to accept, or type a comma-separated list to replace it" prompt. See proposal.md for why matching should support more than one existing feature.

## Goals / Non-Goals

**Goals:**
- Let the match step surface more than one existing-feature candidate and let the engineer choose which of them apply.
- Reuse the existing numbered-list confirmation UX pattern rather than inventing a new interaction style.

**Non-Goals:**
- Changing how *new* features are inferred/allocated (`inferFeatureSplit`, `allocateFeatureIds`) — unchanged, and only runs when zero matches are confirmed (per proposal.md).
- Any change to feature doc generation, the Lark sync steps, or the human review gate for newly generated docs.
- Ranking or scoring matches, or capping how many candidates the model may return.

## Decisions

**Prompt output shape**: change `buildFeatureMatchPrompt()`'s requested JSON from `{"featureId": "<id-or-null>"}` to `{"featureIds": ["<id>", ...]}` (empty array = no match), and update its instruction text from "pick one if confident" to "list every existing feature this change is clearly more work on — usually zero or one, only list more than one when the change plainly spans multiple existing features." `matchExistingFeature()`'s return type becomes `ExistingFeature[]` (empty array instead of `undefined`), filtering returned IDs against `candidates` same as today (drop any ID outside the candidate list, don't error).

**Confirmation UX**: extend `confirmFeatureSplit()`'s existing pattern (numbered list + "press Enter to accept, or type a comma-separated list to replace it") to a new shared helper, e.g. `confirmSelection(items, {formatLabel, prompt})` in `src/cli/helpers.ts`, used by both the existing-feature match step and (re-implementing today's behavior) `confirmFeatureSplit()`. Rationale: the two flows need the same shape of interaction — show N candidates, accept all/some/none by editing a list — so one helper avoids duplicating the parsing/echo logic. Alternative considered: a dedicated `confirmFeatureMatches()` helper copy-pasted from `confirmFeatureSplit()` — rejected as needless duplication of the same list-editing logic for two conceptually identical prompts.

For the match step specifically, the list shows `id) <feature-id> — <summary>` (reusing the existing `summarize()` helper) and accepting means "keep these IDs," so the free-text edit path lets the engineer type a comma-separated subset of the shown IDs to keep (not titles, since these are existing features, not new ones) — pressing Enter accepts all suggested matches, typing `none` (or an empty resulting list) accepts none.

**Call-site behavior**: `matched.length > 0` replaces today's `if (matched)` branch (use IDs as-is, skip inference) in both `startFromTicket` and `startFromDescription`; `matched.length === 0` falls through to today's "no match" branch unchanged (full `inferFeatureSplit` in ticket mode, empty `feature_ids` in description mode) — no partial "remainder" inference, matching proposal.md's simplified scope.

## Risks / Trade-offs

- [Model over-suggests matches on a vague ticket, listing weakly-related features] → Prompt instruction explicitly says "usually zero or one," and the engineer still confirms via the edit-or-accept prompt before any ID is used — same safety net as today's single-match confirm.
- [Generalizing `confirmFeatureSplit()` into a shared helper touches an existing, already-shipped call site] → Behavior for the new-feature-split case must stay pixel-identical (same prompt text, same parsing rules); cover this with the same manual `lv start` run used to verify the new match-confirmation path, not just the new one.
