## Why

`lv start` hard-fails (`process.exit(1)`) the moment a ticket references a feature with no `docs/features/<id>/` directory, or has no Feature ID at all — forcing a separate, easy-to-forget `lv bootstrap` run before every genuinely new feature can be started. There's no path today where starting a ticket can also stand up the feature it introduces.

## What Changes

- `lv start` no longer treats an empty Feature ID field or a missing `docs/features/<id>/` directory as a hard stop.
- When a ticket's Feature ID field is empty, `lv start` allocates a new feature ID via the existing `allocateFeatureIds()` (previously only called from `lv init`).
- When a referenced feature has no docs directory, `lv start` runs bootstrap's autonomous-scan mode inline, seeded with the ticket's title/description as the name/description hint — the same hint shape `lv bootstrap --name --description` already accepts.
- After generating feature docs inline, `lv start` prints the generated files and pauses for a yes/no confirmation before continuing. Declining aborts the run before any branch or commit is created — the generated docs stay uncommitted on disk for manual review/editing, and re-running `lv start` later sees the directory already exists and skips straight past this step.
- On confirming to continue, the now-reviewed feature docs ride along in `lv start`'s single end-of-run commit alongside the branch, analysis doc, and state file — a deliberate, explicit exception to bootstrap's normal "never auto-commit, review and commit manually" rule, justified by the human having just reviewed them in this same flow.
- When a new feature ID was allocated, whether `lv start` syncs it back to the ticket's Feature ID field in Lark Base is controlled by a new `.lv.yaml` key (e.g. `lark.sync_feature_id`), **defaulting to `true`**. When enabled, `lv start` writes the ID to the record automatically (preserving whether the field is a plain string or an array, and appending rather than overwriting if the ticket already references other features) and prints that it did so. When disabled, it skips the write and prints that the allocation is local-only. Either way a team can flip the default per-repo without being prompted on every run — a later `lv start` run against the same or a sibling ticket will allocate a fresh ID rather than recognize this one if the sync never happened, since nothing links them back.

## Capabilities

### New Capabilities
- `lv-start/inline-feature-bootstrap`: `lv start` detects a ticket referencing a feature with no `docs/features/<id>/` directory (or no Feature ID at all), allocates an ID when needed, generates that feature's docs via bootstrap's autonomous-scan mode using the ticket's title/description as hint, and pauses for human review before creating the branch — decline aborts cleanly with no branch or commit; confirm folds the reviewed docs into the ticket's own commit.
- `lv-start/lark-feature-id-sync`: When `lv start` allocates a new feature ID, a configurable `.lv.yaml` setting (default `true`) controls whether it writes that ID back to the ticket's Feature ID field in Lark Base, preserving the field's existing shape and appending alongside any feature IDs already present. Disabled, the allocation stays local-only.

### Modified Capabilities
(none — `openspec/specs/` has no existing capabilities yet for the ticket-start or Lark-integration behavior this touches)

## Impact

- `src/cli/start.ts`: replace the two hard-error branches (empty `featureIds`; missing feature directory) with the inline bootstrap-and-confirm flow, kept before `createBranch()` so a decline touches no git state.
- `src/engine/feature-id.ts`: `allocateFeatureIds()` gains a second caller (`start.ts`), alongside `init.ts`.
- `src/cli/bootstrap.ts`: the autonomous-scan path (`runBootstrapFromScan` or an extracted equivalent) gains a caller from `start.ts`, passed the ticket's title/description as the hint.
- `src/tools/lark.ts`: new write call (e.g. `updateTicketFeatureId`) — requires the configured Lark app's tenant token to carry Bitable write scope, an out-of-repo permissions change in the Lark developer console beyond today's read-only usage.
- `src/cli/helpers.ts`: reuses the existing `confirm()` prompt for the feature-docs review gate only; the Lark-sync step is config-driven, not prompted.
- `src/types.ts` / `src/config.ts`: `ConfigSchema` gains `lark.sync_feature_id` (boolean, default `true`), following the same optional-with-default pattern as other `.lv.yaml` keys.
