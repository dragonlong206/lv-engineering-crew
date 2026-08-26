## Why

The installed archive workflow's feature-doc-refresh guidance only fires when the change being archived has `docs/changes/<change-id>/state.yaml` with recorded feature IDs — the artifact `lv start` writes. This repo's own OpenSpec changes (like the last several archived this session) are authored directly via `/opsx:propose` without going through `lv start`, so they never have a `state.yaml`, and the guidance silently has nothing to instruct — even when the change's delta specs obviously touch a specific feature's docs (e.g. `lv-start/inline-feature-bootstrap` touches the `lv-start` feature). The refresh convention should still fire in that case instead of going quiet.

## What Changes

- When a change being archived has no `docs/changes/<change-id>/state.yaml` (or one with no recorded feature IDs), the archive guidance falls back to checking each of the change's delta spec capability paths: if a capability path's leading segment matches an existing `docs/features/<id>/` directory, that feature is refreshed too.
- The primary source (feature IDs recorded in `state.yaml`) is unchanged and still takes priority when present.
- This fallback is a no-op when it doesn't apply (e.g. a target repo whose capability paths aren't feature-id-prefixed) — it only ever adds a refresh instruction, never removes the existing one, and stays advisory/non-blocking like the rest of this guidance.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `lv-init/feature-doc-freshness`: the archive guidance's feature-ID source gains a capability-path-based fallback for changes with no recorded feature IDs.

## Impact

- `src/prompts.ts`: update `ARCHIVE_GUIDANCE`'s text to describe the fallback.
- `openspec/config.yaml`: the wired copy of `ARCHIVE_GUIDANCE` under `operations.archive.guidance` needs to be updated to match (a manual replacement, not a fresh `lv init` append — `addArchiveGuidance()` only appends when its exact text is missing, it doesn't replace stale wording).
- No change to `addArchiveGuidance()`'s idempotency mechanics itself, or to the `/opsx:sync` convention line in `CONTEXT_POINTER_LINES`.
