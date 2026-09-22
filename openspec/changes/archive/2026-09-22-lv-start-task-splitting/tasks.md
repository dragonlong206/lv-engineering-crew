## 1. Config schema

- [x] 1.1 In `src/types.ts`, add `subtask_parent_field: z.string().optional()` to `LarkConfigSchema` and a new `TaskSplittingConfigSchema` (`{ enabled: z.boolean().default(true), threshold_hours: z.number().positive().default(4) }`) referenced as `task_splitting: TaskSplittingConfigSchema.optional()` on `ConfigSchema` — verify with `npx tsc --noEmit`
- [x] 1.2 Document the new config keys in `.lv.yaml`'s template comments (mirroring the existing `lark.ui_design_field`/`attachment_field` commented-out style) and add a `getTaskSplittingConfig(config)`-style accessor in `src/config.ts` only if reading `config.task_splitting ?? {}` with defaults directly at call sites gets repetitive — otherwise inline it (single call site in `start.ts`, so inlined — no accessor added)

## 2. Lark sub-ticket creation

- [x] 2.1 In `src/tools/lark.ts`, add `createSubticket(title, description, parentTicketId, baseId, tableId, titleField, token, subtaskParentField?)` that POSTs a new record to the ticket table (title + `Description` fields, plus `subtaskParentField` set to `[parentTicketId]` when given) and returns the created `record_id` — parallel to `createFeatureRecord()`; throws on failure (non-fatal wrapping happens at the call site, matching `syncFeatureToLarkTable()`'s split between `createFeatureRecord()` and its wrapper)
- [x] 2.2 Verify with a scratch call against a test Lark Base table: one record created with title/description set, and (when a Link field name is passed) the relationship visibly populated in the Lark UI (verified live via task 7.1's end-to-end run against the real Lark Base — 3 sub-ticket records created with title/description set and `Parent Task` populated, confirmed via direct Lark API reads)

## 3. `TicketSource` interface

- [x] 3.1 In `src/integrations/tickets/types.ts`, add `createSubtickets(parent: Ticket, subtasks: { title: string; description: string }[]): Promise<{ created: { id: string; title: string }[]; failed: { title: string; error: string }[] }>` to the `TicketSource` interface, documented as best-effort per sub-task (same posture as `updateFeatureId`/`updateStatus`)
- [x] 3.2 In `src/integrations/tickets/lark-ticket-source.ts`, implement `createSubtickets()`: loop over `subtasks`, call `createSubticket()` per entry catching failures into `failed`, pass `config.lark.subtask_parent_field` through, and `printWarn()` once up front if it's unset before attempting creation — verify with `npx tsc --noEmit`

## 4. Complexity-analysis agent and prompt

- [x] 4.1 In `src/prompts.ts`, add `buildTaskSplitPrompt(title, description, thresholdHours)` requesting strict JSON `{"shouldSplit": boolean, "reason": string, "subtasks": [{"title": string, "description": string}]}` — model instructed to recommend splitting only when the ticket clearly spans multiple distinct pieces of work or would plausibly exceed `thresholdHours`, and to return `shouldSplit: false` with an empty `subtasks` array otherwise
- [x] 4.2 Create `src/engine/task-splitting.ts` with a module-level throwaway `taskSplitAgent` (`Agent`, matching `featureMatchAgent`'s shape: `registerAgent(new Agent({ id, name, model: "openai/gpt-4o-mini", instructions: "...return only strict JSON..." }))`) and `analyzeTaskComplexity(config, title, description): Promise<{ shouldSplit: boolean; reason: string; subtasks: { title: string; description: string }[] }>` using `getModelForStep(config, 'bootstrap')` and `extractJson()` — verify with `npx tsc --noEmit`

## 5. Confirmation prompt

- [x] 5.1 In `src/cli/helpers.ts`, add `confirmTaskSplit(reason: string, subtasks: { title: string; description: string }[]): Promise<boolean>` — prints the reason and each suggested sub-task's title/description, then asks a single `[y/N]`-style confirm (reuse `confirm()`'s prompt style, not `confirmSelection()`'s list-editing)
- [x] 5.2 Verify by calling it from a scratch script with a 2-3 item suggested split and confirming both the "yes" and "no" paths return the expected boolean (verified live via tasks 7.1/7.2/7.5's end-to-end runs: "y" correctly led to sub-ticket creation, "n" correctly fell through to the unchanged single-ticket flow)

## 6. Wire into `lv start`

- [x] 6.1 In `src/cli/start.ts`'s `startFromTicket()`, after `const ticket = await source.fetch(ticketId);` and before attachment download, call `analyzeTaskComplexity()` when `config.task_splitting?.enabled !== false`; on `shouldSplit: false` fall through to today's flow unchanged
- [x] 6.2 On `shouldSplit: true`, call `confirmTaskSplit()`; on decline, fall through to today's flow unchanged (no state carried over from the analysis)
- [x] 6.3 On confirm, call `source.createSubtickets(ticket, result.subtasks)`, print each created sub-task's ID with the `lv start <id>` guidance (including the one-at-a-time-or-parallel note from proposal.md), print any `failed` entries as warnings, and `return` — no attachment download, feature matching, branch creation, `writeState()`, or `commitAll()` for the parent ticket
- [x] 6.4 Verify with `npx tsc --noEmit` and `npm run build`

## 7. Manual verification

- [x] 7.1 Run `lv start <ticket-id>` against a scratch ticket engineered to trigger a split (e.g. a description listing 3 unrelated pieces of work); confirm the analysis fires, the prompt shows the suggested breakdown, confirming creates 3 linked sub-ticket records in Lark, and no branch/`state.yaml`/commit is created for the parent (verified live against the real Lark Base, in an isolated scratch clone — 3 sub-tickets created with `Parent Task` populated, no branch/state/commit for the parent)
- [x] 7.2 Repeat declining the suggested split; confirm `lv start` proceeds exactly as it did before this change (branch created, `state.yaml` written, commit made) (verified live — branch created, status synced, `state.yaml` written, commit made)
- [x] 7.3 Run `lv start <ticket-id>` against a straightforward, small-scope ticket; confirm no split is suggested and behavior is unchanged (verified live — no split prompt, ran straight through to branch/state/commit)
- [x] 7.4 Set `task_splitting.enabled: false` in `.lv.yaml` and confirm `lv start <ticket-id>` skips the analysis call entirely (no extra LLM call, no prompt) (verified live, config set via `.lv.local.yaml` — a ticket engineered to otherwise trigger a split ran straight through with no prompt)
- [x] 7.5 Run the split-confirmed scenario with `lark.subtask_parent_field` unset; confirm sub-tickets are still created and a warning is printed noting the relationship wasn't recorded (verified live — warning printed, 3 sub-tickets created with `Parent Task` left empty, confirmed via direct Lark API reads)
