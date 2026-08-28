## Purpose

Lets `lv start` handle a change branch that already exists by asking the engineer to resume or restart, instead of failing when it tries to create a branch that is already there.

## ADDED Requirements

### Requirement: lv start detects an already-existing change branch before creating one
The system SHALL check, before creating a branch for the change, whether a branch with that change's rendered name already exists (locally or on `origin`). If it does, the system SHALL stop and ask the engineer to choose between resuming and restarting instead of attempting to create the branch.

#### Scenario: Branch already exists
- **WHEN** the engineer runs `lv start` (ticket-based or `--description`-based) and a branch matching the change's rendered branch name already exists
- **THEN** the system does not attempt to create a new branch and instead prompts the engineer to choose resume or restart

#### Scenario: No existing branch
- **WHEN** the engineer runs `lv start` and no branch matching the change's rendered branch name exists yet
- **THEN** the system proceeds to create and check out the branch as before, without prompting

### Requirement: Resuming checks out the existing branch and completes any missing change context
The system SHALL, when the engineer chooses to resume, check out the existing branch. If `docs/changes/<change-id>/state.yaml` already exists for that change, the system SHALL treat the change as already started and stop after checkout without re-running feature discovery, feature-doc generation, or Lark sync. If `docs/changes/<change-id>/state.yaml` does not exist, the system SHALL continue through the remainder of the start flow — feature discovery, feature-doc generation, and writing `state.yaml` — on the existing branch instead of a newly created one.

#### Scenario: Resume a branch with an existing state.yaml
- **WHEN** the engineer chooses resume and `docs/changes/<change-id>/state.yaml` already exists
- **THEN** the system checks out the existing branch and stops, without re-running feature discovery or writing a new state file

#### Scenario: Resume a branch with no state.yaml yet
- **WHEN** the engineer chooses resume and `docs/changes/<change-id>/state.yaml` does not exist (e.g. the branch was created by an interrupted or manual run)
- **THEN** the system checks out the existing branch, continues through the rest of the start flow, and writes `docs/changes/<change-id>/state.yaml` on that branch

### Requirement: Restarting discards the existing branch and starts the change over
The system SHALL, when the engineer chooses to restart, discard the existing branch and run the full start flow from scratch, as if no branch for the change had existed — including creating a fresh branch from the configured base branch and writing a new `state.yaml`.

#### Scenario: Restart an existing change branch
- **WHEN** the engineer chooses restart for a change whose branch already exists
- **THEN** the system discards the existing branch, creates a new branch for the change from the configured base branch, and runs the rest of the start flow to completion, overwriting any existing `state.yaml` for that change

### Requirement: The existing-branch check applies to both start entry modes
The system SHALL perform the existing-branch check and resume/restart prompt for both ticket-based starts and `--description`-based starts.

#### Scenario: Existing branch on a description-based start
- **WHEN** the engineer runs `lv start --description "..."` and a branch matching the derived change's branch name already exists
- **THEN** the system prompts the engineer to resume or restart, the same as it would for a ticket-based start
