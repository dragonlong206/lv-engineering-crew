## Context

See proposal.md - Why. Two constants in `src/prompts.ts` carry stale wording left over from before `lv bootstrap` was converted to a coding-agent skill/command (PR #16, `e70bcdb`):

- `ARCHIVE_GUIDANCE` — written into `openspec/config.yaml`'s `operations.archive.guidance` by `addArchiveGuidance()` (`src/cli/init.ts`), read by the generated `/opsx:archive` workflow's `operationGuidance` field.
- `CONTEXT_POINTER_LINES[3]` (the `/opsx:sync` convention line) — written into `openspec/config.yaml`'s `context:` by `addContextPointer()`.

Both currently say "by running `lv bootstrap <feature-id>`". That bare invocation now hits `runBootstrap()`'s new guard (`src/cli/bootstrap.ts`) and exits with an error, since `lv bootstrap <feature-id>` with none of `--new-feature`/`--context`/`--finalize` no longer generates anything — the actual doc-generation flow now lives in the `lv-bootstrap` skill/command, driven by the calling coding agent (see `lv-bootstrap/skill-based-generation`).

`addArchiveGuidance()`/`addContextPointer()` are idempotent only against their *current* constant value: each checks whether that exact (whitespace-normalized) string is already present, and appends if not. Neither has ever needed to handle "the wording itself changed" — except one existing precedent, `addProposeStateAutoload()`, which already carries a `LEGACY_PROPOSE_STATE_AUTOLOAD_LINE` constant and a `raw.includes(LEGACY...) → replaceAll` branch for exactly this situation (its own prior wording change). This design reuses that exact pattern rather than inventing a new one.

This repo's own `openspec/config.yaml` already has both `context:` and `operations:` keys active (not template-commented), and already contains the stale wording — it is itself an instance of the bug, not just a hypothetical.

## Goals / Non-Goals

**Goals:**
- The archive guidance and the `/opsx:sync` convention line both instruct an invocation that actually succeeds.
- A project (including this repo) that already has the stale wording gets upgraded to the corrected wording the next time `lv init` runs, without ending up with both the stale and corrected text side by side.
- Follow the existing `addProposeStateAutoload()` legacy-line-replace precedent rather than introducing a different idempotency mechanism.

**Non-Goals:**
- No change to `lv bootstrap`'s CLI surface, flags, or error behavior (`src/cli/bootstrap.ts`).
- No change to the `lv-bootstrap` skill/command's own content (`LV_BOOTSTRAP_SKILL_BODY` and its per-tool renderers) — only the *pointer to it* from archive/sync guidance changes.
- No general-purpose "diff and migrate arbitrary config text" mechanism — this fixes the two known stale strings, the same scope `addProposeStateAutoload()` covers for its own line.

## Decisions

### 1. Wording: point at the skill/command, not a shell one-liner

Replace "by running `lv bootstrap <feature-id>`" with wording that tells the archiving/syncing agent to invoke the `lv-bootstrap` skill/command for that feature ID (mirroring how `LV_BOOTSTRAP_SKILL_BODY` itself is phrased: "Run ... `lv bootstrap <feature-id> --context ...`" as the first of several steps, not a single shell call). Both `ARCHIVE_GUIDANCE` and `CONTEXT_POINTER_LINES[3]` are consumed by an LLM-driven workflow (confirmed via `.claude/commands/opsx/archive.md`'s `operationGuidance` handling — advisory prose, not literally executed shell text), so instructing "invoke the `lv-bootstrap` skill/command for `<feature-id>`" is something the agent can act on directly, the same way it already can invoke any other installed skill.

**Alternative considered**: keep a literal one-line shell command by changing `lv bootstrap`'s bare-invocation behavior to auto-run the whole skill flow non-interactively. Rejected — the skill flow's whole point (per `lv-bootstrap/skill-based-generation`) is that the *calling coding agent* does the exploring/drafting; there is no way for a plain `lv` CLI call to do that itself without reintroducing the separate LLM-agent call the skill conversion deliberately removed.

### 2. Legacy-replace via the existing `LEGACY_*`/`replaceAll` pattern

Add a `LEGACY_ARCHIVE_GUIDANCE` constant (the exact current, stale `ARCHIVE_GUIDANCE` string) and a `LEGACY_CONTEXT_POINTER_SYNC_LINE` constant (the exact current, stale `CONTEXT_POINTER_LINES[3]` string) to `src/prompts.ts`, next to the corrected values. In `src/cli/init.ts`:

- `addArchiveGuidance()`: before its existing "already wired" check, add a branch — if `raw` contains `LEGACY_ARCHIVE_GUIDANCE` (whitespace-normalized) but not the current `ARCHIVE_GUIDANCE`, replace the legacy text with the current text via a targeted string operation (see Decision 3) and return, instead of falling into the append-new-entry path.
- `addContextPointer()`: same shape, scoped to just `CONTEXT_POINTER_LINES[3]` vs. `LEGACY_CONTEXT_POINTER_SYNC_LINE` — the other three lines are untouched by this change and keep their existing per-line "add if missing" behavior.

This exactly mirrors `addProposeStateAutoload()`'s existing `LEGACY_PROPOSE_STATE_AUTOLOAD_LINE` → `raw.replaceAll(LEGACY, current)` shape, so a future reader who already understands that function recognizes this one immediately.

**Alternative considered**: detect "stale" generically (e.g., any existing `operations.archive.guidance` entry not equal to the current constant gets replaced). Rejected — too broad: it would clobber an engineer's own hand-added archive guidance that happens to differ from ours for unrelated reasons. Matching the exact known legacy string is precise and matches the existing precedent's scope.

### 3. Replace in place as raw text, not via the YAML-merge fallback

`addArchiveGuidance()`'s YAML-merge branch (used when `operations:` is already active) re-dumps the whole file via `js-yaml`, losing template comments — an existing, accepted cost for the "add a genuinely new entry" case. The legacy-replace branch added here avoids that cost entirely: since the legacy string is a raw text substring of the file however it got there (raw-appended, or a prior YAML dump), a plain `raw.replaceAll(LEGACY_ARCHIVE_GUIDANCE_AS_WRITTEN, ARCHIVE_GUIDANCE_AS_WRITTEN)` on the file text works without touching anything else in the file, so comments elsewhere survive. This requires matching the string as it was actually serialized (JSON-quoted, per the existing comment on `addArchiveGuidance()` about `": "` needing quoting) rather than the bare constant — the implementation task should verify the on-disk quoted form before relying on a literal `replaceAll`, falling back to a normalized-whitespace `indexOf`/slice replace if quoting styles can differ.

`addContextPointer()`'s stored form is a block-literal (`context: |`) or a YAML-dumped plain string depending on which branch wrote it; the same care applies — replace via the actual on-disk substring, not an assumed exact constant match.

### 4. Dogfood this repo's own `openspec/config.yaml`

After implementing, re-run `lv init` in this repo so its own `openspec/config.yaml` picks up the corrected wording (this repo is a live instance of the bug, per Context above). This is a one-time manual step for this repo, not new product behavior — captured as a task, not a spec requirement.

## Risks / Trade-offs

- **[Risk]** An engineer's `openspec/config.yaml` has the legacy string but reformatted by an intervening manual edit (different quoting/wrapping) so a literal substring match misses it → falls through to the existing append path, producing a duplicate (old + new) rather than a clean replace. **Mitigation**: match on whitespace-normalized content the same way the existing "already wired" check does, locating the legacy entry's span in the raw text rather than requiring a byte-exact substring; this is the same normalization already used elsewhere in `init.ts` (`normalizeWhitespace()`), just applied to locate-and-replace instead of only presence-check.
- **[Risk]** Some other target repo (not this one) ran `lv init` at a different point in this project's history and has yet another wording variant that is neither the current nor the one known-legacy string. **Mitigation**: out of scope — only the one known stale wording introduced by the skill conversion is handled, matching `addProposeStateAutoload()`'s own scope (it only handles its own one known legacy line, not arbitrary prior wordings).

## Migration Plan

1. Update `ARCHIVE_GUIDANCE` and `CONTEXT_POINTER_LINES[3]` in `src/prompts.ts`; add `LEGACY_ARCHIVE_GUIDANCE` and `LEGACY_CONTEXT_POINTER_SYNC_LINE` holding the current (soon-to-be-old) text.
2. Add the legacy-replace branch to `addArchiveGuidance()` and `addContextPointer()` in `src/cli/init.ts`.
3. Build and re-run `lv init` in this repo; verify `openspec/config.yaml` now contains the corrected wording with no leftover stale copy.
4. No rollback concern beyond reverting the commit — the change only affects generated guidance text, not runtime CLI behavior.

## Open Questions

None — the approach follows an existing precedent in this codebase and needs no further decisions before task breakdown.
