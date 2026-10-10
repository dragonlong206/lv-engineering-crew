## Purpose

Lets an engineer who splits a large ticket choose to collect all resulting sub-task work on a shared "big feature" branch, with each sub-task branching from and opening its pull request against that branch instead of the main line.

## Requirements

### Requirement: Big feature git flow is offered only after a confirmed split
The system SHALL, only after the engineer has confirmed a task split during a ticket-based `lv start`, ask whether to follow the big feature git flow. The system SHALL NOT ask when no split was recommended, when the split was declined, or when `lv start` was run with `--description`.

#### Scenario: Engineer confirms split and is asked about the flow
- **WHEN** the engineer confirms a recommended task split
- **THEN** the system asks whether to follow the big feature git flow before creating anything

#### Scenario: No question without a confirmed split
- **WHEN** no split is recommended, or the engineer declines the recommended split
- **THEN** the system does not ask about the big feature git flow

#### Scenario: Declining the flow keeps current behavior
- **WHEN** the engineer confirms the split but declines the big feature git flow
- **THEN** the system creates the sub-tasks and stops without a branch, `state.yaml`, or commit for the parent ticket

### Requirement: Accepting the flow creates the big feature branch for the parent ticket
The system SHALL, when the engineer accepts the big feature git flow, create the sub-task records and then create a branch for the parent ticket named by the configured `branch_types` pattern for the type being started and forked from that type's base branch. The system SHALL write `docs/changes/<parent-ticket-id>/state.yaml` on that branch marked as a big feature, commit it, and push the branch to `origin`.

#### Scenario: Parent branch created and pushed
- **WHEN** the engineer accepts the flow and the sub-tasks are created
- **THEN** the parent branch exists, contains a committed `state.yaml` marked as a big feature, and has been pushed to `origin`

#### Scenario: Push fails
- **WHEN** the parent branch cannot be pushed
- **THEN** the system warns that the branch is local only and continues, leaving the local branch and commit in place

#### Scenario: Parent branch already exists
- **WHEN** a branch for the parent ticket already exists
- **THEN** the existing resume-or-restart handling applies before any split analysis, exactly as for any other ticket

#### Scenario: No sub-task was created
- **WHEN** the engineer accepts the flow but every sub-task record failed to create
- **THEN** the system does not create the parent branch and reports that the flow was skipped

### Requirement: Sub-task branches fork from the big feature branch
The system SHALL, when `lv start <ticket-id>` is run for a ticket whose direct parent ticket has a big-feature branch, create the sub-task branch from that big-feature branch rather than the base branch of the branch type. The system SHALL record that branch as `base_branch` in the sub-task's `state.yaml`.

#### Scenario: Parent has a big-feature branch
- **WHEN** `lv start <sub-ticket-id>` is run and the parent ticket has a branch whose `state.yaml` is marked as a big feature
- **THEN** the sub-task branch is created from that branch and its `state.yaml` records it as `base_branch`

#### Scenario: Parent has no big-feature branch
- **WHEN** the ticket has no parent, the parent cannot be fetched, or no parent branch is marked as a big feature
- **THEN** the sub-task branch is created from the branch type's base branch as before and `state.yaml` has no `base_branch`

#### Scenario: Big-feature branch only exists on the remote
- **WHEN** the big-feature branch exists on `origin` but not locally
- **THEN** the system still detects it and forks the sub-task branch from it

### Requirement: Sub-task pull requests target the big feature branch
The system SHALL tell the engineer, after starting a sub-task forked from a big-feature branch, to open the sub-task's pull request against that branch, and SHALL surface `base_branch` in `lv status` and `lv resume` summaries.

#### Scenario: Next-steps hint after start
- **WHEN** a sub-task is started from a big-feature branch
- **THEN** the printed next steps name the big-feature branch as the pull request target

#### Scenario: Status shows the base
- **WHEN** `lv status` or `lv resume` summarizes a change whose `state.yaml` has `base_branch`
- **THEN** the summary includes the base branch
