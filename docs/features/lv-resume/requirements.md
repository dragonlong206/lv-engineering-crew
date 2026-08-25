<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

### Requirement: Resume current ticket
`lv resume` SHALL continue the current ticket workflow by resolving the ticket branch, reading the ticket state, and acting according to the current step status.

#### Scenario: resume from the current ticket branch
- **GIVEN** the current branch matches a configured ticket branch pattern
- **WHEN** the user runs `lv resume`
- **THEN** the command uses that branch's ticket ID to read state and decide what to do next

#### Scenario: choose a ticket branch when not on one
- **GIVEN** the current branch does not match a configured ticket branch pattern
- **AND** at least one ticket branch exists locally or on `origin`
- **WHEN** the user runs `lv resume`
- **THEN** the command prompts the user to choose a ticket branch
- **AND** checks out the selected branch before continuing

#### Scenario: no ticket branches available
- **GIVEN** the current branch does not match a configured ticket branch pattern
- **AND** no ticket branches exist locally or on `origin`
- **WHEN** the user runs `lv resume`
- **THEN** the command reports that no ticket branches were found
- **AND** exits without continuing the workflow

### Requirement: Resume by ticket ID
`lv resume [ticket-id]` SHALL find a branch for the requested ticket across all configured branch types and check out the matching branch before continuing.

#### Scenario: exactly one matching branch exists
- **GIVEN** multiple branch types may be configured
- **AND** exactly one branch matches the requested ticket ID
- **WHEN** the user runs `lv resume PROJ-123`
- **THEN** the command checks out the matching branch
- **AND** continues using ticket `PROJ-123`

#### Scenario: multiple matching branches exist
- **GIVEN** more than one configured branch type matches the requested ticket ID
- **WHEN** the user runs `lv resume PROJ-123`
- **THEN** the command prompts the user to choose which branch to resume
- **AND** checks out the selected branch

#### Scenario: no existing branch matches
- **GIVEN** no existing branch matches the requested ticket ID
- **WHEN** the user runs `lv resume PROJ-123`
- **THEN** the command derives the default branch-type name for that ticket ID
- **AND** attempts to check out that branch name
- **AND** surfaces git checkout failure if the branch does not exist

### Requirement: Prompt before approval
`lv resume` SHALL ask for confirmation before approving an in-progress step.

#### Scenario: current step is in progress
- **GIVEN** the resolved ticket's current step has status `in_progress`
- **WHEN** the user runs `lv resume`
- **THEN** the command prints the path to the current step's document
- **AND** asks whether to approve the step now

#### Scenario: user approves from resume
- **GIVEN** the current step has status `in_progress`
- **AND** the user answers yes to the approval prompt
- **WHEN** the command continues
- **THEN** it runs the approval flow for the current step

#### Scenario: user declines from resume
- **GIVEN** the current step has status `in_progress`
- **AND** the user answers no to the approval prompt
- **WHEN** the command continues
- **THEN** it tells the user to run `lv answer`
- **AND** does not approve the step

### Requirement: Auto-advance approved analysis
`lv resume` SHALL generate the design document automatically when analysis is already approved.

#### Scenario: analysis is approved
- **GIVEN** the current step is `analysis`
- **AND** the analysis step status is `approved`
- **WHEN** the user runs `lv resume`
- **THEN** the command generates the design document
- **AND** stops after that generation step completes

### Requirement: Report completion
`lv resume` SHALL report that the ticket is fully approved when the current step is already approved and there is no later step to resume.

#### Scenario: final step is approved
- **GIVEN** the current step is not `analysis`
- **AND** the current step status is `approved`
- **WHEN** the user runs `lv resume`
- **THEN** the command reports that all steps are approved
- **AND** tells the user they can create a merge request

### Requirement: Preserve approval safety
`lv resume` SHALL not approve any step without explicit user confirmation.

#### Scenario: automated branch resolution
- **GIVEN** the command is resolving branches or reading state
- **WHEN** it proceeds without a prompt
- **THEN** it only performs read-only actions or already-safe workflow continuation actions

#### Scenario: in-progress step needs approval
- **GIVEN** the current step is in progress
- **WHEN** the command is about to approve it
- **THEN** it requires a positive confirmation from the user first