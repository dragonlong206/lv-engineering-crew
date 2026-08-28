## Purpose

Lets `lv status` tell the engineer where the current change's tracked OpenSpec change(s) stand in the OpenSpec workflow and what to do next, instead of only echoing the persisted `state.yaml` fields.

## ADDED Requirements

### Requirement: Status output includes an OpenSpec-derived next action per tracked change
The system SHALL, after printing the existing state summary, print a next-action suggestion for each OpenSpec change name recorded in the current change's `state.yaml` `openspec_changes` list.

#### Scenario: No OpenSpec change tracked yet
- **WHEN** the engineer runs `lv status` and `openspec_changes` is empty
- **THEN** the system prints a next action suggesting the engineer run `/opsx:propose` to start planning

#### Scenario: Planning artifacts are incomplete
- **WHEN** the engineer runs `lv status` and a tracked OpenSpec change exists but not all of its planning artifacts (proposal, specs, design, tasks) are done or skipped
- **THEN** the system prints, for that tracked change, a next action describing which planning artifact to create next, based on OpenSpec's own reported guidance

#### Scenario: Planning complete, implementation not finished
- **WHEN** the engineer runs `lv status` and a tracked OpenSpec change has all planning artifacts complete but `tasks.md` has at least one unchecked task
- **THEN** the system prints, for that tracked change, a next action suggesting the engineer run `/opsx:apply` to continue implementation

#### Scenario: Implementation complete
- **WHEN** the engineer runs `lv status` and a tracked OpenSpec change has all planning artifacts complete and every task in `tasks.md` checked off
- **THEN** the system prints, for that tracked change, a next action suggesting the engineer run `/opsx:archive`

#### Scenario: Multiple tracked OpenSpec changes
- **WHEN** the engineer runs `lv status` and `openspec_changes` contains more than one name
- **THEN** the system prints a separate next-action suggestion for each tracked name

### Requirement: OpenSpec lookup failure does not fail the command
The system SHALL still print the existing state summary and exit successfully when the OpenSpec status lookup for a tracked name cannot be completed, reporting that the OpenSpec status could not be determined for that name instead of a next action.

#### Scenario: openspec CLI unavailable or errors
- **WHEN** the engineer runs `lv status` and the `openspec` CLI is not available on `PATH`, or the OpenSpec status lookup for a tracked name otherwise fails (including the tracked change no longer existing, e.g. after being archived)
- **THEN** the system prints the existing state summary, reports that OpenSpec status could not be determined for that name, and exits with a success status
