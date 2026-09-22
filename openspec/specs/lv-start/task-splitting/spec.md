## Purpose

Lets `lv start <ticket-id>` detect a ticket that is too large or complex for a single change, propose splitting it into sub-tasks, and — with explicit engineer confirmation — create those sub-tasks as linked records in the ticket system instead of forcing the whole ticket through one branch.

## Requirements

### Requirement: Ticket complexity is analyzed before feature matching or branch creation
The system SHALL, for a ticket-based start with no existing branch to resume, analyze the ticket's title and description before matching or allocating feature IDs and before creating a branch, to determine whether the ticket is too complex, spans multiple distinct pieces of work, or would take longer than the configured threshold to implement as a single change.

#### Scenario: Analysis runs after fetching the ticket, before feature matching
- **WHEN** `lv start <ticket-id>` is run for a ticket with no existing branch
- **THEN** the system fetches the ticket and analyzes its complexity before running existing-feature matching or new-feature allocation

#### Scenario: Resuming an existing branch skips analysis
- **WHEN** `lv start <ticket-id>` is run and a branch already exists for that ticket
- **THEN** the system resumes the existing branch as it does today, without running complexity analysis

#### Scenario: Analysis disabled by configuration
- **WHEN** `task_splitting.enabled` is set to `false` in `.lv.yaml`
- **THEN** the system skips complexity analysis entirely and proceeds directly to today's feature-matching and branch-creation flow

### Requirement: A recommended split is presented for explicit confirmation
The system SHALL, when analysis recommends splitting, present the reason and a suggested breakdown of the ticket into sub-tasks (each with a title and description) to the engineer, and SHALL NOT create any sub-task records, branch, or commit until the engineer explicitly confirms.

#### Scenario: Engineer confirms the suggested split
- **WHEN** the analysis recommends splitting and the engineer confirms the suggested breakdown
- **THEN** the system proceeds to create sub-task records for the suggested breakdown

#### Scenario: Engineer declines the suggested split
- **WHEN** the analysis recommends splitting and the engineer declines
- **THEN** the system proceeds with today's single-ticket flow (feature matching, branch creation, `state.yaml`, commit) as if no split had been suggested

#### Scenario: Analysis finds no need to split
- **WHEN** the analysis determines the ticket does not need to be split
- **THEN** the system proceeds directly with today's single-ticket flow, with no confirmation prompt shown

### Requirement: Confirmed split creates linked sub-task records in the ticket system
The system SHALL, upon a confirmed split, create one new ticket record per suggested sub-task in the ticket system, populated with that sub-task's title and description, and SHALL record each sub-task's relationship to the parent ticket when a relationship field is configured.

#### Scenario: Relationship field is configured
- **WHEN** the split is confirmed and `lark.subtask_parent_field` is set
- **THEN** each created sub-task record's relationship field links back to the parent ticket

#### Scenario: Relationship field is not configured
- **WHEN** the split is confirmed and `lark.subtask_parent_field` is unset
- **THEN** the system still creates each sub-task record with its title and description, skips writing any relationship, and warns that the relationship was not recorded

#### Scenario: One sub-task fails to create
- **WHEN** the split is confirmed and creating one of the suggested sub-task records fails
- **THEN** the system reports that failure and continues creating the remaining sub-task records rather than aborting the whole operation

### Requirement: Confirmed split stops the parent ticket's start without creating a branch
The system SHALL, after creating sub-task records for a confirmed split, print the created sub-task IDs and instructions to start each individually, and SHALL stop without creating a branch, `state.yaml`, or commit for the parent ticket.

#### Scenario: Guidance to start sub-tasks individually
- **WHEN** sub-task records have been created for a confirmed split
- **THEN** the system prints each created sub-task's ID and instructs the engineer to run `lv start <sub-ticket-id>` for each, noting they may be started one at a time or in parallel across separate branches or coding-agent sessions

#### Scenario: No branch or state file for the parent ticket
- **WHEN** sub-task records have been created for a confirmed split
- **THEN** the system does not create a branch, does not write `docs/changes/<ticket-id>/state.yaml`, and does not commit — the parent ticket's `lv start` run ends there
