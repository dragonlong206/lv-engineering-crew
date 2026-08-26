## Why

Today, whenever a ticket's `Feature ID` field is empty (or a change is started with `--description`, which never sets `feature_ids` at all), `lv start` either allocates a brand-new `Fxxxx` feature or leaves the change unlinked to any feature — even when the change is obviously more work on a feature that already exists. The engineer has to notice this themselves and manually fix `feature_ids` in `state.yaml` (or the Feature ID column in Lark) after the fact. `lv start` already knows every existing feature's docs; it should use them to suggest a match instead of defaulting straight to "this is new."

## What Changes

- When a ticket's Feature ID field is empty, or a description-only start would otherwise leave `feature_ids: []`, `lv start` compares the ticket/description against every existing `Fxxxx` feature that has non-empty docs and asks an LLM to pick the best match (or conclude there isn't one).
- If a candidate is found, `lv start` prompts the engineer to confirm it (`Looks like this matches F0003 (<short summary>). Use it? [y/N]`).
  - Confirmed: that feature ID is used as-is — no new ID is allocated, no docs are (re)generated for it.
  - Declined, or the model found no plausible candidate: falls back to today's behavior — ticket mode allocates a new feature ID as before; description mode leaves `feature_ids: []` as before.
- If there are no existing `Fxxxx` features with any docs yet, the match step is skipped silently (no LLM call, no prompt) and today's behavior applies directly.
- Applies to both `lv start <ticket-id>` and `lv start --description "..."`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `lv-start/inline-feature-bootstrap`: adds a match-and-confirm step against existing features before an empty Feature ID falls back to allocating a new one; extends this to the description-only entry mode as well, which previously never attempted to link a feature at all.

## Impact

- `src/cli/start.ts`: both `startFromTicket` and `startFromDescription` gain a match-and-confirm step ahead of their existing "no feature ID" handling.
- `src/engine/feature-id.ts`: add a function to list existing `Fxxxx` features that have non-empty docs, for use as match candidates (companion to the existing `allocateFeatureIds`).
- `src/prompts.ts`: add a prompt builder for the feature-match LLM call, following the existing "strict JSON, no surrounding text" convention (parsed via `extractJson`).
- Reuses the existing `bootstrap` per-step model config (`.lv.yaml`'s `models.bootstrap`) rather than introducing a new model-config key.
- No change to `docs/features/<id>/` generation itself, or to the human review gate that already exists for newly generated docs.
