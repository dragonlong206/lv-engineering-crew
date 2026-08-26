## Why

Today `lv start` can only introduce exactly one new feature per ticket — a ticket implying several distinct features still gets a single feature ID, forcing manual follow-up to split them out. And when a new feature's docs are generated (via `lv bootstrap` or `lv start`'s inline bootstrap), nothing records that feature in Lark Base, so stakeholders browsing Lark have no visibility into which features exist or which ticket introduced them.

## What Changes

- `lv start`'s empty-Feature-ID path no longer always allocates exactly one new feature: an LLM reads the ticket's title/description, infers how many distinct features are implied (with a suggested title for each), and presents that to the engineer to confirm or adjust before any IDs are allocated. A single inferred feature keeps today's one-ID behavior.
- Whenever a feature's docs directory is generated for the first time (a brand-new feature) — whether triggered by `lv bootstrap <feature-id>` run directly, or by `lv start`'s inline bootstrap — the system creates a corresponding record in a dedicated Lark Base "Features" table (feature ID, title, and a link back to the originating ticket when one exists).
- New `.lv.yaml` config identifies the Features table (e.g. `lark.features_table_id` plus the field names to populate) and a toggle to disable the sync, mirroring the existing `lark.sync_feature_id` pattern. The write is best-effort and non-fatal, consistent with existing Lark sync behavior.

## Capabilities

### New Capabilities
- `lv-bootstrap/lark-feature-table-sync`: creates a record in a dedicated Lark Base "Features" table the first time a feature's docs are generated, regardless of which command triggered generation.

### Modified Capabilities
- `lv-start/inline-feature-bootstrap`: the "Empty Feature ID allocates a new feature" requirement changes from always allocating exactly one new feature ID to allocating an LLM-inferred, engineer-confirmed number of new feature IDs.

## Impact

- `src/cli/start.ts` — empty-Feature-ID path: replace single allocation with LLM inference + confirmation loop, then allocate N IDs.
- `src/cli/bootstrap.ts` — `generateFeatureDocsFromScan()` (or its callers): detect first-time generation for a feature ID and trigger the Lark Features-table sync.
- `src/tools/lark.ts` — new function to create a record in the Features table (parallel to the existing ticket Feature-ID write-back).
- `src/types.ts` — `ConfigSchema`: new `lark.features_table_id`, related field-name config, and a sync-enabled toggle.
- `.lv.yaml` (template/docs) and `docs/features/lv-start/`, `docs/features/lv-bootstrap/` — document the new config and behavior once implemented.
