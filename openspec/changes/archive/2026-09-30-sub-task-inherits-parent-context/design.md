## Context

See proposal.md for the motivation. The relevant current state:

- `createSubticket()` (`src/tools/lark.ts`) writes `fields[subtask_parent_field] = [parentTicketId]`, a Bitable Link-field write. On read, that same field comes back in the link-read shape `[{ record_ids, table_id, text, text_arr }]`, which `extractLinkRecordIds()` already parses (it's used for `project_field`).
- `fetchTicket()` reads every field of the record in a single call. It also has an `isLinkField()` metadata lookup, but only `feature_id_field` needs it (to choose between link and text parsing). The parent field is always a Link field by contract (see `LarkConfigSchema`'s comment on `subtask_parent_field`).
- `startFromTicket()` (`src/cli/start.ts`) runs in this order: fetch, then task-splitting decision, then attachment download, then feature matching, then Lark write-backs, then branch, then `state.yaml`, then commit. `ui_design` and `attachments` are populated directly from the fetched `Ticket`.
- `downloadTicketAttachments()` dedupes same-name files only *within one call* (`usedNames`), so making two separate calls into one directory could overwrite files.
- The repo has no automated test suite (CLAUDE.md), so verification is `tsc --noEmit`, `npm run build`, and scripted or manual `lv` runs.

## Goals / Non-Goals

**Goals:**
- Sub-ticket `state.yaml` carries the parent's description (as a separate `parent` block), plus merged UI design references and merged attachments.
- Keep `start.ts` a composition-only orchestrator, and keep the `TicketSource` seam source-agnostic.

**Non-Goals:**
- Inheriting the parent's feature IDs. The ticket's scope is description, attachments and UI design. Feature matching for a sub-ticket still runs as it does today (open question below).
- Changing how sub-tickets are created during a split, or writing anything back to Lark.
- Following the parent chain more than one level up.
- Feeding parent context into the task-splitting analysis, feature matching, or the branch `{summary}`. These keep using the sub-ticket's own title and description, because the parent's text describes more work than the sub-task covers.
- Description-based starts (they have no parent link).

## Decisions

### 1. Resolve the parent at `lv start`, not at split time
The user chose this option. It works for links created by hand in Lark, needs no Lark write scope, and avoids the unverified question of whether Bitable accepts one record's attachment `file_token` in another record. The cost is an extra Lark read per sub-ticket start. If the parent's attachments change later, the sub-task sees the latest version at start time, which is arguably what we want.

### 2. `Ticket.parentId?: string`, extracted during `fetch()`
`fetchTicket()` gains an optional `subtaskParentField` parameter. When the field is set, it returns `parentId` as the first entry of `extractLinkRecordIds(fields[subtaskParentField])`, ignoring a self-link. `toTicket()` maps this onto `Ticket.parentId`. No `isLinkField()` lookup is needed, because a non-link value simply yields `[]`, so the parent is `undefined`.

- *Alternative*: a new `TicketSource.fetchParent(ticket)` method. Rejected because `fetch(parentId)` already does exactly this, and a second method would duplicate it. `start.ts` just calls `source.fetch(ticket.parentId)`.

### 3. Merge in a small pure helper, applied right after the split decision
Add `mergeParentContext(ticket, parent): Ticket` in a new `src/engine/parent-context.ts` (engine layer, same as `task-splitting.ts`). It returns a ticket whose `uiDesignRefs` holds the ordered union (child's references first) and whose `attachments` holds the child's plus the parent's, deduplicated by `fileToken`. The child's own title, description and IDs are untouched.

`startFromTicket()` does this:

```ts
// after the task-splitting block, before attachment download
let parent: Ticket | undefined;
if (ticket.parentId) {
  try { parent = await source.fetch(ticket.parentId); }
  catch (err) { printWarn(`Failed to fetch parent ticket ${ticket.parentId}: ...`); }
}
const context = parent ? mergeParentContext(ticket, parent) : ticket;
// download context.attachments, write context.uiDesignRefs, state.parent from `parent`
```

Placing the parent fetch after the split decision means a ticket being split never pays for a parent fetch. Merging before the single download call lets the existing `usedNames` logic handle collisions between the child's and the parent's same-named files, with no change to `downloadTicketAttachments()`.

- *Alternative*: download the parent's attachments into `attachments/parent/`. Rejected: it needs a second download call and a naming convention the propose instructions would have to learn, while the flat list already works with `PROPOSE_ATTACHMENT_LINE` unchanged.
- *Note*: `source.fetch()` prints "Fetching ticket <id> from Lark Base...", which also serves as visible progress for the parent fetch. Write-back methods (`updateFeatureId`, `updateStatus`) keep receiving the original `ticket`, never the merged one or the parent, which satisfies the "read-only toward Lark" requirement.

### 4. `state.yaml` gets `parent: { ticket_id, title, description }`, and nothing is folded into `description`
`StateSchema` gains an optional `parent` object. Keeping the parent separate preserves `description` as the sub-task's scope. `/opsx:propose` step 1 uses `description` as the change description, so appending the parent's text there would make the proposal plan the whole parent. `ui_design`/`attachments` are merged instead of nested, because they are reference material that the existing propose instructions already consume without being scope-defining.

### 5. One more `/opsx:propose` patch: `PROPOSE_PARENT_CONTEXT_LINE`
Following the established pattern, add the text constant to `src/prompts.ts` and an `addProposeParentContextInstruction()` function in `src/cli/init.ts`. That function is a copy of `addProposeAttachmentInstruction()`: same anchor (`PROPOSE_ASK_USER_LINE_RE`) and its own idempotency check, called from the same place in `runInit`. The generic `CONTEXT_POINTER_LINES` is left unchanged, since only proposal writing needs to treat the parent as background as opposed to scope. The three near-identical patch functions could be collapsed into one helper that takes a line and a label, but that refactor stays out of scope.

This repo's own `.claude/commands/opsx/propose.md` and `.claude/skills/openspec-propose/SKILL.md` get the line by re-running `lv init` (dogfooding) as part of implementation.

## Risks / Trade-offs

- [The parent link field configured as a text field, not a Link] → `extractLinkRecordIds()` returns `[]`, so no parent is found and there's silent no-op inheritance. Mitigation: `subtask_parent_field` is already documented as a Link field, and the feature docs will state that inheritance requires it.
- [A large parent attachment set gets duplicated into every sub-task's `attachments/` directory and committed by `commitAll()`] → Accepted: it's the same size cost as the parent's own change would have had, and each sub-task branch is independent. Engineers can remove files before committing if needed.
- [Parent description conflicts with the sub-task's narrower scope during planning] → Handled by keeping `parent` separate and having the propose instruction say explicitly "background, not scope".
- [A parent link to a ticket in a different table] → `fetch()` reads from `config.lark.table_id`, so that fetch fails and becomes a non-fatal warning. Cross-table parents are unsupported.

## Open Questions

- Should a sub-ticket with no feature ID inherit the parent's feature IDs, rather than running feature matching? That's deferrable: it changes neither this design nor its tasks, and it can be a follow-up change.
