## 1. Candidate listing

- [x] 1.1 In `src/engine/feature-id.ts`, add `listExistingFeatures(repoRoot, prefix, digits)` that scans the same `Fxxxx`-pattern directories as `allocateFeatureIds()` and returns `{ id, overview }[]` for each one whose `overview.md` exists and is non-empty (trimmed).

## 2. Matching prompt and call

- [x] 2.1 In `src/prompts.ts`, add `buildFeatureMatchPrompt(title, description, candidates)` that lists each candidate's ID and `overview.md` content and asks for strict JSON `{ "featureId": "<id-or-null>" }` with no surrounding text, following this file's existing JSON-prompt convention.
- [x] 2.2 In `src/cli/start.ts`, add a helper (e.g. `matchExistingFeature(config, repoRoot, title, description)`) that: calls `listExistingFeatures()`; returns `undefined` immediately if the candidate list is empty; otherwise runs a throwaway single-shot `Agent.generate()` call (same shape as `bootstrapAgent` in `bootstrap.ts`) with `buildFeatureMatchPrompt()` and `model: getModelForStep(config, "bootstrap")`; parses the result with `extractJson<{ featureId: string | null }>()`; validates the returned `featureId` is present in the candidate list (treat an unrecognized ID as `undefined`, same as `null`); returns the matched candidate or `undefined`.

## 3. Wire into lv start

- [x] 3.1 In `startFromTicket()`, when `ticket.featureIds.length === 0`, call `matchExistingFeature()` before the existing allocation step. If it returns a candidate, prompt via `confirm()`: `` Looks like this matches ${id} (${summary}). Use it? [y/N] `` (derive `summary` from the first non-empty line of the candidate's overview content, falling back to the id alone). On confirm, set `featureIds = [id]` and skip both `newlyAllocatedFeatureId` assignment and the missing-docs generation loop for that ID (the directory already has docs). On decline or no candidate, fall through to the existing allocation code unchanged.
- [x] 3.2 In `startFromDescription()`, call `matchExistingFeature()` using the derived `title` and the given `description`. If confirmed, set `feature_ids: [id]` in the written `state.yaml` instead of `[]`. On decline or no candidate, keep `feature_ids: []` as today.

## 4. Verification

- [x] 4.1 Run `npx tsc --noEmit` to confirm the new code type-checks.
- [x] 4.2 Manually verify against a scratch repo with at least one existing `Fxxxx` feature with real `overview.md` content: run `lv start --description "<text closely matching that feature>"`, confirm the match prompt appears, confirm it, and check the written `state.yaml` has `feature_ids: [<that id>]`.
- [x] 4.3 Manually verify: same scratch repo, run `lv start --description "<unrelated text>"`, confirm no match is proposed (or decline if one is), and check `feature_ids: []` in the resulting `state.yaml`, matching current behavior.
- [x] 4.4 Manually verify: a repo with zero non-empty `Fxxxx` features — confirm no match prompt appears and no LLM call is made (e.g. by checking no added latency / by temporarily breaking network and confirming the command still proceeds instantly to the existing fallback).
