## Context

`state.yaml` is committed on the PR branch, and archive-on-merge already reads it via `resolve-merged-change.mjs` (checkout is the default branch after merge, so the PR's `state.yaml` is present there). The refresh flow ends in `lv bootstrap <id> --finalize` both when the engineer's agent runs it and when CI's headless agent does. `lv link` already shows the pattern for mutating state from the current branch (`currentBranch` + `matchBranch` + `state-io`).

## Goals / Non-Goals

**Goals:** a deterministic marker that the pipeline can read; no extra LLM or agent behavior needed.
**Non-Goals:** detecting whether docs are semantically up to date; invalidating the marker when later commits touch the feature's code.

## Decisions

1. **Marker in `state.yaml` (`refreshed_features: string[]`, optional), not in the feature docs.** `state.yaml` is already the per-change source of truth and the CI input, and putting it in the docs would add noise to generated files. Alternative: a header comment in `overview.md` — rejected because docs are LLM-rewritten.
2. **Written by `--finalize`, not by the agent.** Finalize is the one deterministic step that always ends a refresh, so the marker cannot be forgotten like the refresh itself can. It reuses `currentBranch` + `matchBranch` as in `lv link`, and a new `markFeatureRefreshed()` in `state-io.ts` (idempotent, like `addOpenspecChange`).
3. **Non-fatal.** Off a change branch (e.g. CI on the default branch) it silently records nothing; a `printWarn` is not needed there since that is the normal CI path.
4. **Filtering in `resolve-merged-change.mjs`.** Emit `feature-ids` minus `refreshed_features`. The workflow's existing `feature-ids != '[]'` conditions then skip the build and refresh steps with no workflow YAML change.

## Risks / Trade-offs

- Edits to the feature's code after the engineer's refresh leave docs stale, since the marker stays set. Accepted: the goal is avoiding duplicate LLM refreshes; docs are advisory and can be refreshed by hand.
- The marker must be committed on the PR branch to reach CI; if the engineer refreshes but never commits `state.yaml`, CI refreshes again (safe fallback).
