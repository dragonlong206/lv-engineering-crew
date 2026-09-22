## Why

`lv start <ticket-id>` always treats a ticket as exactly one unit of work: one branch, one `state.yaml`, one OpenSpec change. A ticket that is actually too large or complex — spanning multiple unrelated pieces of work, or realistically taking more than a few hours — still gets funneled through that same single-branch flow, so the engineer only discovers the ticket should have been split after they're already deep into it. `lv start` already runs LLM analysis on a ticket's title/description before committing to feature IDs (`matchExistingFeature`/`inferFeatureSplit`); it's a natural extension to run a similar analysis for task complexity, up front, before any branch work begins.

## What Changes

- `lv start <ticket-id>` (ticket-based starts only — see Non-Goals below) runs a new complexity-analysis step right after fetching the ticket and before feature matching: an LLM reads the ticket's title/description and decides whether it's too complex, spans multiple distinct pieces of work, or would take longer than a configurable threshold (default 4 hours) to implement as one change.
- When the analysis recommends splitting, the engineer is shown the reason and a suggested breakdown into sub-tasks (title + description each) and must explicitly confirm before anything is created — accept the whole suggested split, or decline and continue with today's single-ticket flow. There is no inline editing of individual suggested sub-tasks in this change; the engineer accepts the set as a whole or declines it.
- On confirmation, `lv start` creates one new ticket record per sub-task in the same Lark ticket table (title + description populated), linking each back to the parent ticket via a configured relationship field when one is set. Creation is best-effort per sub-task — one failure is reported without discarding the others.
- After creating the sub-tickets, `lv start` prints their IDs and instructs the engineer to run `lv start <sub-ticket-id>` for each — one at a time, or in parallel across separate branches/coding-agent sessions if they choose — and stops without creating a branch, `state.yaml`, or commit for the parent ticket itself.
- When the analysis finds no need to split, or the engineer declines a suggested split, `lv start` proceeds exactly as it does today.
- New `.lv.yaml` config: `task_splitting.enabled` (default `true`) to disable the analysis step entirely, `task_splitting.threshold_hours` (default `4`) to tune the estimate threshold fed to the model, and `lark.subtask_parent_field` (optional) naming the Link field on the ticket table used to record each sub-ticket's parent. Leaving `subtask_parent_field` unset still creates the sub-tickets but skips the relationship write and warns.

## Capabilities

### New Capabilities

- `lv-start/task-splitting`: `lv start` can detect an overly large/complex ticket, propose splitting it into sub-tasks, and — on confirmation — create those sub-tasks as linked records in the ticket system instead of proceeding with a single branch.

### Modified Capabilities

(none — this is purely additive; it runs as a new step before the existing feature-matching/branch-creation flow and only diverts from it when the engineer confirms a split)

## Impact

- `src/cli/start.ts`: `startFromTicket()` gains a complexity-analysis-and-split step between `source.fetch(ticketId)` and attachment download; a confirmed split returns early (no attachment download, feature matching, or branch/state/commit for the parent ticket).
- `src/engine/task-splitting.ts` (new): a throwaway single-shot agent (matching the `featureMatchAgent`/`featureSplitAgent` pattern in `src/engine/feature-matching.ts`) plus `analyzeTaskComplexity()`, parsing the model's JSON verdict and suggested sub-tasks.
- `src/prompts.ts`: new `buildTaskSplitPrompt()`.
- `src/cli/helpers.ts`: a new confirmation prompt presenting the suggested sub-task breakdown (accept/decline, no per-item editing) — distinct from `confirmSelection()`/`confirmFeatureSplit()` since it confirms a whole plan rather than narrowing a list.
- `src/tools/lark.ts`: new function to create a ticket-table record for a sub-task (title + description, plus the parent-link field when configured) — parallel to `createFeatureRecord()`.
- `src/integrations/tickets/types.ts` / `src/integrations/tickets/lark-ticket-source.ts`: `TicketSource` gains a `createSubtickets()` method; Lark is the only implementation.
- `src/types.ts`: `ConfigSchema` gains `task_splitting: { enabled, threshold_hours }`; `LarkConfigSchema` gains `subtask_parent_field`.
- `docs/features/lv-start/overview.md`/`design.md`: document the new step once implemented (via `lv bootstrap lv-start`, not hand-edited here).
