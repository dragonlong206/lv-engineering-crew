## Why

Archive guidance asks the engineer's coding agent to refresh feature docs (`lv-bootstrap`) before a change is archived. The `archive-on-merge` workflow then refreshes the same docs again, headlessly. When the agent already refreshed them, the second LLM pass can rewrite them differently and creates churn on the default branch. Nothing records that a refresh already happened, so the pipeline cannot tell.

## What Changes

- `lv bootstrap <feature-id> --finalize` records the feature ID as refreshed in the current change's `docs/changes/<change-id>/state.yaml` (new optional `refreshed_features` list). It is idempotent and non-fatal: if the current branch is not a change branch, or there is no `state.yaml`, it records nothing and finalize still succeeds.
- `scripts/ci/resolve-merged-change.mjs` omits features listed in `refreshed_features` from its `feature-ids` output, so the existing `feature-ids != '[]'` guards skip the build and headless refresh steps for them. Archiving of OpenSpec changes is unaffected.
- The CI workflow runs `--finalize` on the default branch, which matches no change branch, so the marker is only ever written on the PR branch by the engineer's own run.

## Capabilities

### New Capabilities
- `lv-bootstrap/feature-docs-refreshed-marker`: `--finalize` records a feature as refreshed in the current change's state.

### Modified Capabilities
- `ci-archive-on-merge`: the headless feature doc refresh skips features already marked refreshed.

## Impact

- `src/types.ts` (`StateSchema`), `src/engine/state-io.ts` (new `markFeatureRefreshed()`), `src/cli/bootstrap.ts` (`runBootstrapFinalize`).
- `scripts/ci/resolve-merged-change.mjs`.
- Docs: `docs/features/devops` and `docs/features/lv-bootstrap` get refreshed at archive.
- Backward compatible: the field is optional, so existing `state.yaml` files behave as before (everything refreshed).
