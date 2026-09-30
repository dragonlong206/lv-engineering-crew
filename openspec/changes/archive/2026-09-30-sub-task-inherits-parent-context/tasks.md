## 1. Types and Lark extraction

- [x] 1.1 Add optional `parent: { ticket_id, title, description }` to `StateSchema` in `src/types.ts`; verify with `npx tsc --noEmit`
- [x] 1.2 Add `parentId?: string` to `LarkTicket` and an optional `subtaskParentField` param to `fetchTicket()` (and `larkTicketTool`) in `src/tools/lark.ts`, returning the first `extractLinkRecordIds()` entry that isn't the ticket's own ID; verify with `npx tsc --noEmit`
- [x] 1.3 Add `parentId?: string` to `Ticket` in `src/integrations/tickets/types.ts`, and pass `config.lark.subtask_parent_field` through `fetch()` and map `parentId` in `toTicket()` in `lark-ticket-source.ts`; verify with `npx tsc --noEmit`

## 2. Merge and orchestration

- [x] 2.1 Create `src/engine/parent-context.ts` with a pure `mergeParentContext(ticket, parent)`: ordered-union `uiDesignRefs` (child first) and `attachments` concatenated and deduped by `fileToken`, other fields untouched; verify with a scratch `npx tsx` script asserting the `[A]` + `[A, B]` → `[A, B]`, parent-only `[B]`, and same-`fileToken` cases
- [x] 2.2 In `startFromTicket()` (`src/cli/start.ts`), after the task-splitting block, fetch `ticket.parentId` via `source.fetch()` inside try/catch (warn naming the parent ID on failure), and build the merged context; verify with `npx tsc --noEmit`
- [x] 2.3 Use the merged context's `attachments` for the single `downloadAttachments()` call and its `uiDesignRefs` for `state.ui_design`, while keeping the original `ticket` for every write-back, branch `{summary}`, and feature matching; verify with `npx tsc --noEmit` and by reading the diff
- [x] 2.4 Write `parent: { ticket_id, title, description }` into `state` only when a parent was fetched; verify with `npx tsc --noEmit`

## 3. Propose workflow patch

- [x] 3.1 Add `PROPOSE_PARENT_CONTEXT_LINE` to `src/prompts.ts` (an `LV Crew:` line: when the matched `state.yaml` has a `parent` block, use its title/description as background only while creating `proposal`, keep scope to the change's own title/description, and don't propose the parent's other work); verify with `npx tsc --noEmit`
- [x] 3.2 Add `addProposeParentContextInstruction()` to `src/cli/init.ts` (same anchor and idempotency check as `addProposeAttachmentInstruction()`) and call it from `runInit` after the attachment patch; verify with `npx tsc --noEmit`

## 4. Scenario verification (no automated test framework — scripted/manual per scenario)

- [x] 4.1 Run `npm run build`, then run `lv init --tool claude` in this repo twice. Verify `.claude/commands/opsx/propose.md` and `.claude/skills/openspec-propose/SKILL.md` contain the parent-context line exactly once (covers "Re-running lv init does not duplicate the patch", "Sub-task with a parent block", "No parent block")
- [x] 4.2 In a scratch repo with `lark.subtask_parent_field` configured, run `lv start` on a real sub-ticket whose parent has a description, a UI design ref, and an attachment. Verify `state.yaml` has `parent.{ticket_id,title,description}`, its own `title`/`description` unchanged, merged `ui_design`, and the parent's file under `attachments/` (covers "Sub-ticket links to a parent", "Parent resolved", "Only the parent has UI design references", "Parent has attachments, sub-ticket has none")
- [x] 4.3 In the same setup, give the sub-ticket a UI design ref shared with the parent, the same uploaded file, and a different same-named file. Verify dedupe and `-2` suffixing (covers "Both tickets have UI design references", "Both tickets reference the same file", "Different files with the same name")
- [x] 4.4 Run `lv start` on a ticket with an empty parent link, then again with `subtask_parent_field` unset. Verify there's no parent fetch log line, no `parent` field, and `state.yaml` matches pre-change output (covers "Ticket has no parent link", "Parent field not configured", "No parent resolved")
- [x] 4.5 Point the parent link at a deleted/inaccessible record (or temporarily force `source.fetch` to throw for the parent ID). Verify a warning names the parent ID and the start completes without a `parent` block (covers "Parent fetch fails"). Also force one parent attachment download to fail and verify the warning and partial list (covers "A parent attachment fails to download")
- [x] 4.6 Use a sub-ticket whose parent itself has a parent. Verify only one extra "Fetching ticket" line appears (covers "Grandparent is not followed"). Then run on a ticket where the split is confirmed and verify no parent fetch occurs (covers "Ticket being split does not resolve a parent")
- [x] 4.7 After 4.2, check the parent and sub-ticket records in Lark. Verify the parent is unmodified and the sub-ticket received only the feature-ID/status write-backs (covers "Inheritance is read-only toward Lark")

## 5. Docs

- [x] 5.1 Update CLAUDE.md's ticket-pipeline section to mention the `parent` block and parent-context merge in `lv start`. Verify by reading the updated paragraph
