<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

### Requirement: Resolve current ticket
The command SHALL derive the active ticket from the checked-out branch and refuse to run when the branch does not match a known ticket branch format.

#### Scenario: ticket branch is active
- **GIVEN** the user is on a branch that matches the configured ticket branch naming rules
- **WHEN** `lv answer` starts
- **THEN** it uses that branch to identify the ticket being updated

#### Scenario: not on a ticket branch
- **WHEN** the current branch does not match a ticket branch format
- **THEN** the command exits with an error and tells the user to start a ticket first

### Requirement: Enforce workflow state
The command SHALL only run when the current ticket step allows an answer update.

#### Scenario: step is eligible
- **GIVEN** the ticket state allows answering the current step
- **WHEN** `lv answer` runs
- **THEN** it continues to the edit-and-regenerate flow

#### Scenario: step is already approved
- **GIVEN** the current step is already approved
- **WHEN** `lv answer` runs
- **THEN** the command refuses to run and tells the user to continue with design instead

### Requirement: Edit current document
The command SHALL open the current step's document in the user's editor before regenerating content.

#### Scenario: analysis step
- **GIVEN** the ticket is in the analysis step
- **WHEN** `lv answer` runs
- **THEN** it opens `1.proposal.md` for editing

#### Scenario: design step
- **GIVEN** the ticket is in the design step
- **WHEN** `lv answer` runs
- **THEN** it opens `3.design.md` for editing

### Requirement: Regenerate analysis doc
The command SHALL update the analysis proposal after the engineer closes the editor when the current step is analysis.

#### Scenario: analysis edits are saved
- **GIVEN** the user edited `1.proposal.md`
- **WHEN** the command resumes after the editor closes
- **THEN** it regenerates the proposal content from the edited file
- **AND** it writes the updated content back to `1.proposal.md`

#### Scenario: review after update
- **WHEN** the analysis document has been rewritten
- **THEN** the command prints a message telling the user to review the file and either run `lv answer` again or run `lv approve`

### Requirement: Regenerate design bundle
The command SHALL update the design document, task list, and spec delta files after the engineer closes the editor when the current step is design.

#### Scenario: design edits are saved
- **GIVEN** the user edited `3.design.md`
- **WHEN** the command resumes after the editor closes
- **THEN** it regenerates the design output from the edited file
- **AND** it writes the updated content to `3.design.md`
- **AND** it writes the updated content to `5.tasks.md`
- **AND** it writes the current spec delta files under `2.specs/`

#### Scenario: removed feature delta
- **GIVEN** the regenerated design output no longer includes a previously generated feature delta
- **WHEN** the command writes spec delta files
- **THEN** it removes the obsolete delta file from `2.specs/`

### Requirement: Track iteration metadata
The command SHALL update the current step record after each answer cycle.

#### Scenario: first iteration
- **GIVEN** the step has no prior iteration record
- **WHEN** `lv answer` completes successfully
- **THEN** the step record is created or updated with `status` set to `in_progress`
- **AND** `iterations` is incremented to 1
- **AND** the selected model is recorded
- **AND** token usage and duration are recorded

#### Scenario: repeated iterations
- **GIVEN** the step already has iteration history
- **WHEN** `lv answer` completes successfully again
- **THEN** the new usage and duration are added to the existing totals
- **AND** the iteration count increases by one

### Requirement: Commit updated work
The command SHALL commit the written documents and state after a successful answer cycle.

#### Scenario: analysis cycle completes
- **WHEN** the analysis update finishes successfully
- **THEN** the command commits the updated document and state with a ticket-specific commit message

#### Scenario: design cycle completes
- **WHEN** the design update finishes successfully
- **THEN** the command commits the updated design files, spec deltas, and state with a ticket-specific commit message

### Requirement: Reuse step memory
The command SHALL preserve conversation context per ticket and step across repeated answer runs.

#### Scenario: same ticket answered again
- **GIVEN** the user runs `lv answer` multiple times for the same ticket step
- **WHEN** each agent update executes
- **THEN** the agent uses the same ticket-and-step memory thread for that step
