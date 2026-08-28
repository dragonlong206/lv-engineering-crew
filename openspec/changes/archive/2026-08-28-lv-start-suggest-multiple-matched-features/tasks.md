## 1. Prompt and matcher

- [x] 1.1 Update `buildFeatureMatchPrompt()` in `src/prompts.ts` to request `{"featureIds": ["<id>", ...]}` (empty array = no match) and instruct the model to list every clearly-matching existing feature, not just the single best guess
- [x] 1.2 Update `matchExistingFeature()` in `src/cli/start.ts` to parse `featureIds`, filter to IDs present in `candidates`, and return `ExistingFeature[]` (empty array instead of `undefined`) — verify with `npx tsc --noEmit`

## 2. Shared confirmation helper

- [x] 2.1 Add `confirmSelection(items, opts)` to `src/cli/helpers.ts` generalizing `confirmFeatureSplit()`'s numbered-list "press Enter to accept, or type a comma-separated list to replace it" pattern, parameterized by how each item is labeled and how an edited entry maps back to a kept item
- [x] 2.2 Reimplement `confirmFeatureSplit()` on top of `confirmSelection()`, preserving its exact prompt text and comma-separated-titles parsing — verify by re-running the existing "ticket implies multiple distinct features" manual scenario and confirming identical prompts/output
- [x] 2.3 Add a matched-features confirmation path using `confirmSelection()` that lists each candidate as `<id> — <summary>` and lets the engineer keep all (Enter), a comma-separated subset of IDs, or none — verify with a scratch run showing 2+ candidates and checking each accept-all/subset/none path

## 3. Wire into `lv start`

- [x] 3.1 In `startFromTicket`, replace the single-match `if (match) confirm(...)` block with the new multi-match confirmation; when the confirmed set is non-empty use those IDs directly (skip `inferFeatureSplit`), when empty fall through to today's inference path unchanged
- [x] 3.2 In `startFromDescription`, replace the single-match `if (match) confirm(...)` block the same way — confirmed IDs populate `feature_ids`, empty confirmed set leaves `feature_ids` empty as today
- [x] 3.3 Verify with `npx tsc --noEmit` and `npm run build`

## 4. Manual verification

- [x] 4.1 Run `lv start --description "..."` against a scratch repo with 2+ existing features whose docs plausibly match, and confirm: all-accepted, subset-accepted, and none-accepted paths each produce the expected `feature_ids`
- [x] 4.2 Run `lv start <ticket-id>` (or the same scenario via a stubbed ticket) with no accepted matches and confirm the existing new-feature inference/allocation flow still runs unchanged
