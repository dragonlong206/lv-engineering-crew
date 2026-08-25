<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

### Requirement: Gate on approved analysis
The design command SHALL run only after the ticket's analysis step has been approved.

#### Scenario: analysis is approved
- **GIVEN** the current ticket branch matches a ticket state
- **AND** the analysis step status is `approved`
- **WHEN** the engineer runs the design command
- **THEN** the command proceeds to generate design artifacts

#### Scenario: analysis is not approved
- **GIVEN** the current ticket branch matches a ticket state
- **AND** the analysis step status is anything other than `approved`
- **WHEN** the engineer runs the design command
- **THEN** the command exits with an error
- **AND** the error explains that analysis must be approved first

### Requirement: Require ticket branch
The design command SHALL run only on a branch that matches a tracked ticket branch.

#### Scenario: on a ticket branch
- **GIVEN** the current git branch matches a ticket branch
- **WHEN** the engineer runs the design command
- **THEN** the command loads the matching ticket state and continues

#### Scenario: not on a ticket branch
- **GIVEN** the current git branch does not match a ticket branch
- **WHEN** the engineer runs the design command
- **THEN** the command exits with an error
- **AND** the error instructs the engineer to run `lv start <ticket-id>` first

### Requirement: Generate design artifacts
The design command SHALL generate a design document, a task checklist, and any required spec delta files for the ticket.

#### Scenario: design output is produced
- **GIVEN** the command is allowed to run
- **WHEN** the design agent returns valid output
- **THEN** the command writes `3.design.md`
- **AND** it writes `5.tasks.md`
- **AND** it writes one file per returned spec delta under `2.specs/<feature-id>.md`

#### Scenario: no requirements change
- **GIVEN** the design agent returns an empty `specDeltas` object
- **WHEN** the command finishes writing output
- **THEN** no spec delta files are created

### Requirement: Persist design step state
The design command SHALL update the ticket state after generating artifacts.

#### Scenario: design generation succeeds
- **GIVEN** the command generated the design artifacts successfully
- **WHEN** the command advances the workflow state
- **THEN** the ticket's current step moves forward from analysis
- **AND** the design step record stores the selected model, token counts, and duration
- **AND** the updated state is written to disk before committing

### Requirement: Commit generated changes
The design command SHALL commit the generated files and state changes after successful execution.

#### Scenario: command completes successfully
- **GIVEN** the design artifacts were written and state was persisted
- **WHEN** the command reaches the end of execution
- **THEN** it commits all changes in the repository
- **AND** the commit message includes the ticket ID