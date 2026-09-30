## Why

`lv start`'s task splitting (`lv-start/task-splitting`) creates each sub-ticket in Lark with only a generated title and a short description, linked back to its parent through `lark.subtask_parent_field`. When the engineer later runs `lv start <sub-ticket-id>`, the sub-task's `state.yaml` holds only that thin title and description. The parent's full description, its UI design references and its downloaded attachments never reach the sub-task's change context. As a result, `/opsx:propose` for a sub-task plans without the requirements, designs and documents that the original ticket carried.

## What Changes

- On a ticket-based `lv start`, after fetching the ticket, the system reads the ticket's `lark.subtask_parent_field` link (when configured). If it links to a parent ticket, the system also fetches that parent ticket.
- The sub-task's change context inherits the parent's context:
  - **Description**: the parent's ticket ID, title and description are recorded in a new optional `parent` block in `state.yaml`. The sub-task's own `title`/`description` stay unchanged and remain the change's primary scope.
  - **UI design**: the parent's UI design references are merged into the sub-task's `ui_design`, with the sub-task's own references listed first and duplicates removed.
  - **Attachments**: the parent's attachments are downloaded into the same `docs/changes/<sub-ticket-id>/attachments/` directory and listed in `attachments`, together with the sub-task's own attachments (deduplicated by file identity).
- Inheritance is best-effort: if the parent can't be fetched, or the parent field isn't configured or is empty, `lv start` warns (when relevant) and continues with the sub-task's own context, exactly as it does today.
- This works for every ticket linked through `subtask_parent_field`, whether `lv start`'s split created the link or someone created it by hand in Lark.
- `lv init` patches the `/opsx:propose` workflow with one more `LV Crew:` line. When the matched `state.yaml` has a `parent` block, the proposal treats the parent's description as background context, not as the sub-task's scope.
- Nothing is written back to Lark. Sub-ticket creation during a split is unchanged.

## Capabilities

### New Capabilities
- `lv-start/parent-context-inheritance`: when a started ticket links to a parent ticket through `lark.subtask_parent_field`, `lv start` fetches the parent and merges its description (as a `parent` block), UI design references and attachments into the sub-task's change context.

### Modified Capabilities
- `lv-init/openspec-bootstrap`: the `/opsx:propose` workflow patch gains an instruction to use `state.yaml`'s `parent` block as background context when creating the proposal.

## Impact

- `src/tools/lark.ts`: `fetchTicket()`/`LarkTicket` extract the parent record ID from the configured `subtask_parent_field` link value (reusing `extractLinkRecordIds()`).
- `src/integrations/tickets/types.ts` and `lark-ticket-source.ts`: `Ticket` gains an optional `parentId`; `fetch()` passes the parent field through.
- `src/cli/start.ts`: after the task-splitting decision (only when the ticket isn't being split), the system fetches the parent, merges its UI design references and attachments before the attachment download, and writes a `parent` block into `state.yaml`.
- `src/types.ts`: `StateSchema` gains an optional `parent: { ticket_id, title, description }`.
- `src/prompts.ts` and `src/cli/init.ts`: new `PROPOSE_PARENT_CONTEXT_LINE` and a matching idempotent patch function.
- The parent fetch adds one extra Lark API read (plus the parent's attachment downloads) to `lv start` for sub-tickets. Ticket-based starts without a parent link and description-based starts are unaffected.
- `docs/features/lv-start/` docs need a refresh when this change is archived.
