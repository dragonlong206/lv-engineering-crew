## MODIFIED Requirements

### Requirement: Confirmed split stops the parent ticket's start without creating a branch
The system SHALL, after creating sub-task records for a confirmed split, print the created sub-task IDs and instructions to start each individually. Unless the engineer accepted the big feature git flow, the system SHALL stop without creating a branch, `state.yaml`, or commit for the parent ticket.

#### Scenario: Guidance to start sub-tasks individually
- **WHEN** sub-task records have been created for a confirmed split
- **THEN** the system prints each created sub-task's ID and instructs the engineer to run `lv start <sub-ticket-id>` for each, noting they may be started one at a time or in parallel across separate branches or coding-agent sessions

#### Scenario: No branch or state file for the parent ticket
- **WHEN** sub-task records have been created for a confirmed split and the engineer did not accept the big feature git flow
- **THEN** the system does not create a branch, does not write `docs/changes/<ticket-id>/state.yaml`, and does not commit — the parent ticket's `lv start` run ends there

#### Scenario: Big feature git flow accepted
- **WHEN** sub-task records have been created for a confirmed split and the engineer accepted the big feature git flow
- **THEN** the system creates the parent big-feature branch as defined by the `big-feature-git-flow` capability before the run ends
