## Context

`ARCHIVE_GUIDANCE` (`src/prompts.ts`) is plain advisory text, read by `/opsx:archive` via `openspec instructions archive --change <name> --json`'s `operationGuidance` field and interpreted by whatever coding agent runs the archive — there is no code that parses or executes this string; it is prose an agent reads and (advisorily) acts on. See proposal.md - Why.

`addArchiveGuidance()` (`src/cli/init.ts`) writes this text into `openspec/config.yaml`'s `operations.archive.guidance` list, but only appends when its exact (whitespace-normalized) text is missing — it has no logic to detect and replace a stale prior version of the guidance. This repo's own `openspec/config.yaml` already carries an earlier, hand-edited copy of this text (from a prior session's manual wording simplification).

## Goals / Non-Goals

**Goals:**
- The archive guidance still identifies a feature to refresh when a change has no `docs/changes/<change-id>/state.yaml`, as long as its delta specs give an obvious hint.

**Non-Goals:**
- Making `addArchiveGuidance()` detect and replace stale guidance text automatically — out of scope; this change edits `openspec/config.yaml` by hand once, the same way the prior wording simplification was applied.
- Touching the `/opsx:sync` convention line in `CONTEXT_POINTER_LINES` — its existing wording ("any feature IDs this change touches") is already generic enough not to hard-code the `state.yaml`-only assumption this fix addresses for archive.
- A general "ask an LLM to judge relevance" fallback — rejected in favor of a deterministic, no-op-safe rule (see Decisions).

## Decisions

**Fallback rule: capability path's leading segment vs. an existing `docs/features/<id>/` directory.**
Deterministic and safe to ship broadly via `lv init` to any target repo: when the leading segment doesn't correspond to an existing feature directory (the common case for domain-named capabilities like `user-auth` in a typical target repo using `Fxxxx` product features), the fallback simply finds nothing and the guidance falls through to its existing "nothing to instruct" behavior — it never fabricates a refresh instruction. It happens to fire correctly for this repo's own self-documentation convention (capability paths like `lv-start/inline-feature-bootstrap` are already prefixed with the feature directory name `lv-start`), which is exactly the case motivating this change.

**Applied as a manual edit to both `src/prompts.ts` and `openspec/config.yaml`, not a fresh `lv init` run.**
Re-running `lv init` would call `addArchiveGuidance()`, which only checks for the exact new text and, not finding it, would append a second bullet alongside the stale one rather than replacing it (see Context). Editing both files directly keeps `operations.archive.guidance` at exactly one entry.

## Risks / Trade-offs

- [A target repo's capability paths coincidentally have a leading segment matching an unrelated `docs/features/<id>/` directory name, triggering an unwanted refresh] → Accepted: the refresh itself is harmless (`lv bootstrap` only regenerates docs, printed as "review before committing," never auto-committed) and this is the same class of best-effort heuristic the guidance already was.
