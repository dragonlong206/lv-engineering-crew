## Context

See `proposal.md` - Why. Today `src/cli/start.ts` treats an empty `Feature ID` field, or a `featureId` with no `docs/features/<id>/` directory, as a fatal `process.exit(1)` before any git state is touched (`createBranch()` runs after both checks). Everything this change needs already exists as separate pieces that aren't wired together:

- `allocateFeatureIds()` (`src/engine/feature-id.ts`) — next-available `Fxxxx` allocation, currently only called from `lv init`.
- `runBootstrapFromScan()`'s hint path (`src/cli/bootstrap.ts` / `buildBootstrapScanPrompt`) — already accepts a `name`/`description` hint pair shaped exactly like `LarkTicket.title`/`.description`.
- `LarkConfigSchema` (`src/types.ts:31`) and the `lark:` block in `.lv.yaml` — the natural home for a new `sync_feature_id` key.
- `confirm()` (`src/cli/helpers.ts`) — already used by `resume.ts` for a similar "waiting on you" gate, defaulting to decline (`[y/N]`).

`lark.ts` today is read-only (`fetchTicket` only); this change adds its first write call.

## Goals / Non-Goals

**Goals:**
- Let `lv start` create a brand-new feature's docs inline, with a human review gate before any git state changes.
- Keep a newly allocated feature ID linked back to Lark by default, without adding a second interactive prompt per run.

**Non-Goals:**
- Supporting a ticket that introduces *multiple* brand-new (not-yet-IDed) features in one run. An empty `Feature ID` field is treated as exactly one new feature. Tickets needing more than one new feature must pre-allocate via `lv init`/`lv bootstrap` and list the resulting IDs explicitly.
- Changing how already-referenced-and-already-bootstrapped features behave — that path (dir exists) is untouched.
- Building a general Lark write API — only the single Feature ID field update needed here.

## Decisions

**Batch one confirmation per `lv start` run, not one per feature.** A ticket can reference several feature IDs; if more than one is missing its docs directory, all are generated first, then their paths are printed together behind a single confirm prompt. Per-feature prompts were considered and rejected — they add repetitive friction for a case (multiple new features in one ticket) that's already a Non-Goal edge case in practice, and a single gate keeps the "review, then continue" moment simple to reason about.

**Review-gate confirm defaults to decline (`[y/N]`), matching `resume.ts`'s existing convention.** These are freshly AI-generated docs for scope nobody has verified yet, so the safer default is to require an explicit yes.

**Lark-sync defaults to *enabled*, opposite polarity from the review gate, and is config — not a prompt.** Rationale: the review gate guards against acting on unverified content (high cost if wrong, so default-off), while the sync gate guards against a low-cost, reversible action (writing an ID string) whose *failure to happen* has a compounding cost (duplicate feature IDs on every future run against the same ticket). Making it a config default instead of a per-run prompt avoids nagging on every `lv start` invocation for a decision that's really repo-level policy, not per-ticket judgment. Alternative considered: keep it as a per-run prompt like the review gate — rejected because, unlike reviewing generated content, there's nothing new to evaluate each time; the answer is the same every run until someone changes their mind about the policy.

**Sequencing stays entirely before `createBranch()`.** Both the missing-feature-dir loop and the new allocate-and-bootstrap path replace the two existing hard-error branches in place, preserving today's invariant that a decline (now: declining the confirm) leaves no git state behind.

**Sync writes append, not overwrite, and mirror the field's existing shape.** `fetchTicket` already parses the Feature ID field as either a comma-joined string or an array (`lark.ts:69-78`); the write-back reads that same shape back from `rawFields` and produces the matching type, adding the new ID rather than replacing the field's value — a ticket that already references one existing feature and gains a second, brand-new one must not lose the first.

**Reviewed feature docs join the ticket's single end-of-run commit.** Confirmed in the earlier discussion: once a human has explicitly reviewed and confirmed, folding those docs into `commitAll()` alongside the branch/analysis/state is a deliberate, scoped exception to bootstrap's normal "never auto-commit" rule — the review *is* the missing verification step that rule exists to enforce.

## Risks / Trade-offs

- **[Risk]** Docs generated from ticket title/description alone (no code to scan yet) may be thin or speculative. → **Mitigation**: the review gate exists specifically to catch this before it becomes part of the ticket's history; generated files keep the existing `AUTO_GENERATED_HEADER` marker.
- **[Risk]** Bundling feature docs into the ticket's commit is a scoped exception to an established convention, and could surprise someone used to "bootstrap never auto-commits." → **Mitigation**: it only happens after the same-flow confirm; the printed file list before that confirm makes the exception visible in the moment, not silent.
- **[Risk]** The Lark app's tenant token needs Bitable *write* scope, granted outside this repo (Lark developer console) — until granted, every sync attempt fails. → **Mitigation**: sync failure is explicitly non-fatal (see spec's "Sync failures don't block the ticket start"); `lv start` still completes and prints why the sync didn't happen, so it's diagnosable rather than a silent gap.
- **[Risk]** Declining the confirm, or sync being disabled/failing, both leave a feature ID that isn't linked back to Lark — a later run (same or a different ticket) will allocate a fresh ID for what a human intends as the same feature, producing two `docs/features/<id>/` directories for one conceptual feature. → **Mitigation**: none automated; this is a known, accepted cost of the opt-out paths, surfaced via printed messaging at the time so it's a visible trade a user is making, not a hidden one.

## Migration Plan

Purely additive — no `state.yaml` schema version bump, no breaking change to existing CLI flags or already-passing `lv start` invocations (a ticket whose features already exist behaves identically). Rollout is a single code change:

1. Add `sync_feature_id: z.boolean().default(true)` to `LarkConfigSchema` (`src/types.ts:31`) and document it in `.lv.yaml`'s `lark:` block alongside `feature_id_field`/`title_field`.
2. Add the Feature-ID write call to `src/tools/lark.ts`.
3. Replace `start.ts`'s two hard-error branches with the allocate/bootstrap/confirm/sync flow described above, ahead of `createBranch()`.

Rollback is a plain revert — nothing persisted changes shape, so no data migration is needed either direction. Before this ships, the Lark app's write scope needs to be granted in the Lark developer console, or every sync will hit the non-fatal failure path described above.
