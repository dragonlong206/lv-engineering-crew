## Context

`lv start <ticket-id>` (`src/cli/start.ts`'s `startFromTicket()`) already runs two throwaway single-shot LLM calls before creating a branch — `matchExistingFeature()` and `inferFeatureSplit()` in `src/engine/feature-matching.ts`, both using `getModelForStep(config, 'bootstrap')` and the `extractJson()`/strict-JSON convention documented in `CLAUDE.md`. This change adds a third such call, for a different question ("is this ticket too big for one change?") asked before those two even run, since a ticket that gets split shouldn't have its *sub-tasks'* feature IDs guessed against the parent ticket's title.

`lv start` only ever talks to the ticket system through the `TicketSource` interface (`src/integrations/tickets/types.ts`), with Lark (`src/integrations/tickets/lark-ticket-source.ts` / `src/tools/lark.ts`) as the only implementation. Creating sub-tickets needs a new write capability on that interface and in `src/tools/lark.ts`, parallel to the existing `createFeatureRecord()`/`syncFeatureToLarkTable()` pair.

## Goals / Non-Goals

**Goals:**
- Catch an oversized/multi-part ticket before the engineer is committed to a single branch for it.
- Keep the analysis advisory and reversible — the engineer always has final say, and declining leaves today's flow completely unchanged.
- Reuse existing patterns (throwaway agent, `TicketSource` abstraction, config-gated optional sync) rather than introducing new ones.

**Non-Goals:**
- **Description-based starts (`lv start --description`) are out of scope.** The core value here is syncing sub-tasks into the ticket system with a relationship; there is no ticket system in play for a description-based start. A future change could add local-only splitting (e.g. printing several `lv start --description` invocations to run) for that path.
- **No automated parallel execution or "agent team" orchestration.** `lv start` prints guidance that sub-tasks can be started one at a time or in parallel (separate branches/coding-agent sessions); it does not launch or coordinate any coding agents itself. This matches the existing architectural boundary: `lv`'s job stops at handing context to OpenSpec, which is itself driven by the engineer's coding agent, not by `lv`.
- **No inline editing of individual suggested sub-tasks.** The engineer accepts the suggested breakdown as a whole or declines it; adjusting a sub-task's title/description happens by editing the created record in Lark afterward, same as any other ticket edit. (`confirmFeatureSplit()`'s comma-separated-titles editing doesn't transfer well to entries that also carry a description, so this change doesn't attempt it.)
- **No copying of attachments or UI design references onto sub-tickets.** Those stay on the parent ticket; a sub-task record only gets a title, description, and (when configured) the parent-relationship link.
- **No change to how an already-existing branch resumes.** Complexity analysis only runs on a fresh start (`resolveExistingBranch()` finds nothing to resume) — resuming takes priority, matching how feature-matching is already skipped on resume.

## Decisions

**Where the analysis runs in `startFromTicket()`.** Immediately after `source.fetch(ticketId)`, before attachment download and before `matchExistingFeature()`. Rationale: it only needs `ticket.title`/`ticket.description`, both already in hand; running it before attachment download avoids downloading files for a ticket that's about to be abandoned in favor of its sub-tasks; running it before feature matching avoids guessing feature IDs for a parent ticket whose actual work is about to move to separate sub-tickets.

**Reusing `models.bootstrap` for the model, not a new step key.** `CLAUDE.md` documents that `lv start`'s feature-match/split agents deliberately reuse `models.bootstrap` rather than getting a per-step key of their own, since `bootstrap` is described as "the only remaining per-step override." This change follows that same convention instead of adding a fourth `models.*` key for one more single-shot classifier call.

**A single yes/no confirmation, not a multi-select.** The existing-feature-match and new-feature-split confirmations (`confirmSelection()`/`confirmFeatureSplit()`) let the engineer narrow a list because every item is interchangeable (a feature ID, a feature title). A task split is a single coherent plan — accepting a subset of the suggested sub-tasks while silently dropping the rest of the original ticket's scope is more likely to lose work than to help, so this change asks one confirm-or-decline question over the whole plan (new helper, not a reuse of `confirmSelection()`).

**New `TicketSource.createSubtickets()` method, not a generic "create ticket" primitive.** Kept narrow and named for what it actually does (mirrors `updateFeatureId`/`updateStatus` being specific rather than a generic "patch ticket" method), consistent with the interface's existing non-goal (documented inline in `types.ts`) of not growing into a full CRUD abstraction over every possible ticket system. Returns a `{created, failed}` pair (same shape as `downloadAttachments()`'s `{downloaded, failed}`) so a partial failure is reported without an exception unwinding the whole confirmed split.

**Relationship field is optional config (`lark.subtask_parent_field`), matching `ui_design_field`/`attachment_field`.** Not every Lark ticket table will have a self-referencing Link field set up for this. Unset means "create the sub-tickets, skip the relationship, warn" — the same posture the codebase already takes for optional integration points, rather than making relationship-recording a hard prerequisite for the whole feature.

**`task_splitting.enabled` / `task_splitting.threshold_hours` as new top-level config, not under `lark:`.** The complexity analysis itself has nothing to do with Lark (it only reads title/description); only the resulting sub-ticket creation does. Splitting the config this way keeps `lark:` scoped to actual Lark API concerns, consistent with `default_branch_type`/`branch_types` already living at the top level rather than nested under a single integration.

## Risks / Trade-offs

- **[Risk] The LLM's complexity estimate is unreliable** (both false positives that annoy engineers with unnecessary prompts, and false negatives that miss a ticket that should split) → **Mitigation**: the analysis is advisory only — declining is a single keystroke and produces exactly today's behavior, and `task_splitting.enabled: false` opts a repo out entirely.
- **[Risk] Sub-ticket creation partially fails (e.g. 2 of 3 records created)** → **Mitigation**: best-effort per-sub-task creation with a failure summary printed at the end, consistent with how `syncFeatureToLarkTable()`/status sync already treat Lark writes as non-fatal; the engineer can create the missing sub-ticket manually and still `lv start` it.
- **[Trade-off] Splitting stops the parent ticket's `lv start` run with no branch/state created**, so a subsequent `lv start <parent-ticket-id>` re-runs the same analysis from scratch rather than resuming a partial state. This is intentional — there's nothing meaningful to resume once the ticket has been split — but it does mean the analysis LLM call runs again on re-entry (cheap, single-shot, same cost class as today's feature-match call).

## Migration Plan

Purely additive — no existing `state.yaml`, branch, or Lark record shape changes. Repos that don't set `lark.subtask_parent_field` keep working exactly as before except for the one new confirm-or-decline prompt (skippable entirely via `task_splitting.enabled: false`). No data migration or rollback steps beyond reverting the change.
