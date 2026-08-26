## Context

See `proposal.md` - Why for the motivation. Relevant current state:

- `src/cli/init.ts`'s `addContextPointer()` already writes an idempotent, check-then-append `context:` block into `openspec/config.yaml` — raw text append when `context:` is still only present in the template's comments, falling back to a `js-yaml` parse+re-dump merge (losing template comments) only when an active `context:` key already exists to merge into. The `CONTEXT_POINTER` text it writes currently lives as a constant inside `init.ts` itself.
- `CLAUDE.md` documents `src/prompts.ts` as the single home for prompt/instructional text (`BOOTSTRAP_AGENT_INSTRUCTIONS`, `buildBootstrap*Prompt(...)`), "not scattered per-agent." `CONTEXT_POINTER` living in `init.ts` instead is an existing exception to that rule, not yet corrected because `integrate-openspec-workflow` (which introduced it) predates this change.
- `openspec/config.yaml`'s template also documents a separate, unrelated key: `operations: <artifact>: guidance:`, a list of advisory strings. Confirmed live (not just documented) by reading the generated `.claude/commands/opsx/archive.md`: it runs `openspec instructions archive --change "<name>" --json`, gets an `operationGuidance` field back, and is instructed to "read and consider every entry, and follow entries that are applicable... Do not... copy their text verbatim into specs, change artifacts, or archive summaries."
- `openspec instructions` has no `sync` operation in the installed CLI (1.10.0) — confirmed by running it directly (`Artifact 'sync' not found... Valid artifacts: proposal, specs, design, tasks`). The generated `openspec-sync-specs` skill only ever fetches `openspec instructions specs ...` for artifact *rules* (to shape main-spec content), and never reads the `context:` field. There is no config-level hook that reaches a manual `/opsx:sync` run.
- `docs/changes/<change-id>/state.yaml` already carries `feature_ids: [...]` for any change — this is the list an archive-time guidance instruction needs, and it requires no new plumbing to produce.
- `generateFeatureDocsFromScan()` (`src/cli/bootstrap.ts`) already refines an existing draft rather than overwriting it, which is exactly the behavior wanted when `lv bootstrap <id>` is re-run at archive time against docs that already exist.

## Goals / Non-Goals

**Goals:**
- Configure the one hook that's actually wired (`operations.archive.guidance`) so archiving nudges a feature-doc refresh, using the same idempotent-append pattern `addContextPointer()` already established.
- Be honest in the sync case: state the convention where an engineer/agent will read it (`context:`), without pretending it's enforced.

**Non-Goals:**
- No new blocking/gating of `openspec archive` or `openspec sync` — both remain OpenSpec's own commands, untouched, consistent with this repo's standing decision not to wrap or gate OpenSpec operations.
- No editing of OpenSpec-generated files (`.claude/skills/openspec-*`, `.claude/commands/opsx/*`) — same precedent `integrate-openspec-workflow` already established for the `context:` pointer.
- No staleness-detection mechanism (e.g., a content-hash check surfaced by `lv status` warning that a feature's source changed since its docs were last generated). Discussed during exploration as a reasonable backstop for when the advisory guidance gets ignored, but deliberately deferred — it's a separate, independently useful piece of work, not required for this change's specs.
- No change to `lv bootstrap` itself.

## Decisions

### 1. A second idempotent-append function, `addArchiveGuidance()`, in `src/cli/init.ts` — its text constant lives in `src/prompts.ts`, not `init.ts`
`addArchiveGuidance()` (the file-IO/orchestration logic: check-then-append against `openspec/config.yaml`) stays in `init.ts`, matching where `addContextPointer()`'s logic already lives. But the guidance text itself — `ARCHIVE_GUIDANCE` — is a `src/prompts.ts` constant, imported into `init.ts`, not a module-level constant defined in `init.ts`. This corrects the existing exception (see Context) rather than repeating it: `CONTEXT_POINTER` moves from `init.ts` into `src/prompts.ts` as part of this change too, so both instructional-text constants end up centralized together. `runInit()` calls `addArchiveGuidance(repoRoot)` alongside the existing `addContextPointer(repoRoot)` after install. Guidance text: instructs reading the current change's `docs/changes/<change-id>/state.yaml`, and for each listed feature ID, running `lv bootstrap <feature-id>` to refresh that feature's docs before completing the archive.

**Alternatives considered:**
- Folding archive-guidance writing into `addContextPointer()` as one combined function touching two unrelated config keys — rejected; `context:` and `operations.archive.guidance` are structurally independent keys with different merge shapes (a string vs. a nested list), and conflating them would make the "already wired?" check ambiguous (partially wired states become possible: context present, guidance not, or vice versa) and are more complex to reason about than two small, single-purpose functions run in sequence.
- Leaving `CONTEXT_POINTER` where it already sits in `init.ts` and only putting the new `ARCHIVE_GUIDANCE` in `prompts.ts` — rejected per explicit correction: `src/prompts.ts` is meant to be the single home for prompt/instructional text of any kind, not just LLM agent instructions, so leaving `CONTEXT_POINTER` behind would perpetuate the inconsistency this change is otherwise introducing a second instance of.

### 2. Detecting whether `operations:` is active decides which write path to take — same fork `addContextPointer()` already uses for `context:`
`operations.archive.guidance` is a nested structure (`operations: archive: guidance: [...]`), not a flat scalar like `context:`, so the two write paths are:
- **Fully fresh** (`operations:` doesn't appear active anywhere, i.e. only inside the template's comments): append a new top-level block directly as text — safe because there's no existing `operations:` key to collide with.
- **Already active** (`/^operations:/m` matches, meaning an engineer already customized `apply:` and/or `archive:` guidance, or has an `archive:` key without a `guidance:` list yet, or already has both): parse+re-dump via `js-yaml`, deep-merging into `parsed.operations.archive.guidance` (creating `archive`/`guidance` as needed) and appending the new string only if an equivalent entry isn't already present — same comment-loss trade-off `addContextPointer()` already accepts for its own active-key case.

**Alternatives considered:** always doing a raw text append regardless of existing state — rejected; YAML forbids duplicate top-level keys, so blindly appending a second `operations:` block when one already exists (however partial) would produce invalid YAML the moment an engineer had customized anything under it.

### 3. The sync-time convention is one additional line in the existing `CONTEXT_POINTER` text, not a new (unread) config key
Since no `operations.sync.guidance` consumer exists, inventing a config key for it would be dead configuration — present in the file, read by nothing, and liable to convince a future reader it does something. Instead, the existing `context:` pointer (already read by every `openspec instructions <artifact>` call, and already the thing engineers/agents are told to read "before proposing, designing, or implementing anything") gets a third line: refresh touched features' docs when syncing directly, and this line is unenforced.

**Alternatives considered:** writing an `operations.sync.guidance` key anyway, in anticipation of OpenSpec adding a consumer for it later — rejected as speculative config with no current effect; per this project's stated preference against designing for hypothetical requirements, add it if and when OpenSpec actually reads it (see Open Questions).

## Risks / Trade-offs

- **[Risk]** The `operations.archive.guidance` merge path is more complex than `context:`'s (nested list vs. flat scalar), and an engineer with a partially-customized `operations:` block (e.g., `apply:` guidance set, no `archive:` key) is a real case the merge must handle correctly, not just the two extremes. → **Mitigation**: the active-key detection routes any non-trivial existing `operations:` block through the `js-yaml` merge path, which builds missing intermediate keys (`archive`, `guidance`) rather than assuming they're present.
- **[Risk]** `operations.archive.guidance` is advisory — an archiving agent can read it and not act on it, same as any operation guidance. This change reduces the chance of staleness by default, it doesn't eliminate it. → **Mitigation**: accepted; a staleness-detection backstop is real future work but out of this change's scope (see Non-Goals).
- **[Trade-off]** The sync-time line is pure documentation with zero verification — an engineer can run `/opsx:sync` and never see or act on it if their agent doesn't surface `context:` prominently. → **Accepted**: it's strictly better than the status quo (no mention at all), and upgrading it to an enforced hook is blocked on OpenSpec, not on this change.

## Migration Plan

- Purely additive, idempotent appends — same rollout story as `addContextPointer()`. Existing target repos (and this repo, once `integrate-openspec-workflow` lands) pick up both new blocks the next time `lv init` runs.
- No rollback beyond `git revert` — no external state involved.

## Open Questions

- If a future OpenSpec release adds an `operations.sync.guidance` hook (mirroring `archive`), should `lv init` start writing to it, moving the convention out of the `context:` text? Left for a follow-on change once that hook exists — doesn't affect this change's specs, decisions, or tasks today.
