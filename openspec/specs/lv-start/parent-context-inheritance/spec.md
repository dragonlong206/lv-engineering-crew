## Purpose

Lets `lv start` carry a parent ticket's context (its description, UI design references, and attachments) into the change context of a sub-ticket linked to it, so a sub-task started on its own isn't planned without the requirements and materials the original ticket carried.

## Requirements

### Requirement: A started ticket's parent is resolved from the configured parent link
The system SHALL, on a ticket-based `lv start` with no existing branch to resume, read the fetched ticket's `lark.subtask_parent_field` link value (when that setting is configured) and, if it links to another ticket record, treat the first linked record as the ticket's parent. The system SHALL follow only this direct parent link, not the parent's own parent.

#### Scenario: Sub-ticket links to a parent
- **WHEN** `lark.subtask_parent_field` is configured and `lv start <sub-ticket-id>` fetches a ticket whose parent field links to ticket `<parent-id>`
- **THEN** the system fetches ticket `<parent-id>` and uses it as the parent context source for this change

#### Scenario: Parent field not configured
- **WHEN** `lark.subtask_parent_field` is unset
- **THEN** the system performs no parent lookup and behaves exactly as it did before this capability existed

#### Scenario: Ticket has no parent link
- **WHEN** `lark.subtask_parent_field` is configured but is empty on the fetched ticket
- **THEN** the system performs no parent fetch and writes no `parent` block to `state.yaml`

#### Scenario: Grandparent is not followed
- **WHEN** the resolved parent ticket itself links to another parent through the same field
- **THEN** the system inherits context only from the direct parent and does not fetch the grandparent

#### Scenario: Ticket being split does not resolve a parent
- **WHEN** task-splitting analysis recommends a split for the fetched ticket and the engineer confirms it
- **THEN** the system does not fetch that ticket's parent, since no change context is created for the ticket being split

### Requirement: A failed parent fetch is non-fatal
The system SHALL report a failure to fetch the parent ticket as a warning and SHALL continue starting the sub-ticket with only its own context.

#### Scenario: Parent fetch fails
- **WHEN** the parent link resolves to a record that can't be fetched (e.g. deleted, no permission, or a network error)
- **THEN** the system prints a warning naming the parent ticket ID, writes no `parent` block, and completes the start (branch, `state.yaml`, commit) using the sub-ticket's own context

### Requirement: The parent's description is recorded as a separate parent block
The system SHALL record the parent's ticket ID, title, and description in a `parent` block of the sub-ticket's `docs/changes/<sub-ticket-id>/state.yaml`. It SHALL leave the sub-ticket's own `title` and `description` unchanged. When no parent was resolved, the system SHALL omit the `parent` block entirely.

#### Scenario: Parent resolved
- **WHEN** `lv start <sub-ticket-id>` resolves and fetches parent ticket `<parent-id>`
- **THEN** the written `state.yaml` contains `parent.ticket_id` equal to `<parent-id>`, and `parent.title` and `parent.description` equal to the parent ticket's title and description
- **AND** the top-level `title` and `description` are still the sub-ticket's own

#### Scenario: No parent resolved
- **WHEN** no parent is resolved for the started ticket
- **THEN** the written `state.yaml` has no `parent` field

### Requirement: The parent's UI design references are merged into the sub-ticket's
The system SHALL merge the parent's UI design references into the sub-ticket's `ui_design` list, putting the sub-ticket's own references first and then any parent references not already present. The field SHALL remain omitted when the merged list is empty.

#### Scenario: Both tickets have UI design references
- **WHEN** the sub-ticket's UI design references are `[A]` and the parent's are `[A, B]`
- **THEN** the written `state.yaml`'s `ui_design` is `[A, B]`

#### Scenario: Only the parent has UI design references
- **WHEN** the sub-ticket has no UI design references and the parent has `[B]`
- **THEN** the written `state.yaml`'s `ui_design` is `[B]`

### Requirement: The parent's attachments are downloaded into the sub-ticket's change
The system SHALL download the parent's attachments into the sub-ticket's `docs/changes/<sub-ticket-id>/attachments/` directory, together with the sub-ticket's own attachments. The same file SHALL NOT be downloaded twice when both tickets reference it. The system SHALL list every successfully downloaded file in `state.yaml`'s `attachments`, following the same non-fatal failure handling and same-name deduplication as the sub-ticket's own attachments.

#### Scenario: Parent has attachments, sub-ticket has none
- **WHEN** the parent ticket has attachment `spec.pdf` and the sub-ticket has no attachments
- **THEN** `spec.pdf` is downloaded into `docs/changes/<sub-ticket-id>/attachments/` and its repo-relative path is listed in `state.yaml`'s `attachments`

#### Scenario: Both tickets reference the same file
- **WHEN** the sub-ticket and its parent both reference the same uploaded file
- **THEN** that file is downloaded once and listed once in `attachments`

#### Scenario: Different files with the same name
- **WHEN** the sub-ticket and its parent each have a different file named `design.png`
- **THEN** both are downloaded under distinct filenames and both are listed in `attachments`

#### Scenario: A parent attachment fails to download
- **WHEN** one of the parent's attachments fails to download
- **THEN** the system warns naming that file and continues, listing only the successfully downloaded files

### Requirement: Parent context inheritance never writes to the ticket system
The system SHALL NOT modify the parent ticket or copy any parent field into the sub-ticket's record in the ticket system as part of inheriting context.

#### Scenario: Inheritance is read-only toward Lark
- **WHEN** `lv start <sub-ticket-id>` inherits context from its parent
- **THEN** the parent ticket's record is not updated, and the sub-ticket's record receives only the write-backs `lv start` already performs (feature ID and status)
