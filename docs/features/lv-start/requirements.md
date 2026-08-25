<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

### Requirement: Fetch ticket from Lark
The command SHALL fetch the ticket from Lark Base using the configured base, table, feature field, and title field before starting the workflow.

#### Scenario: Ticket lookup succeeds
- **WHEN** the user runs `lv start <ticket-id>` with valid Lark credentials and configuration
- **THEN** the command fetches the record for that ticket from Lark Base
- **AND** it uses the configured title field and feature field from the record

#### Scenario: Ticket is missing
- **WHEN** Lark does not return a record for the requested ticket ID
- **THEN** the command fails with an error

### Requirement: Require feature IDs
The command SHALL refuse to start a ticket that does not reference at least one feature ID in the configured Lark feature field.

#### Scenario: No feature IDs are present
- **GIVEN** the ticket record exists
- **WHEN** the configured feature field is empty
- **THEN** the command exits with an error
- **AND** it tells the user to set the field in Lark Base before running `lv start`

### Requirement: Validate feature docs
The command SHALL verify that every referenced feature already has a docs directory in the repository before creating the ticket branch.

#### Scenario: All feature docs exist
- **GIVEN** the ticket references one or more feature IDs
- **WHEN** each corresponding `docs/features/<feature-id>` directory exists
- **THEN** the command continues to branch creation and analysis generation

#### Scenario: A feature docs directory is missing
- **GIVEN** the ticket references one or more feature IDs
- **WHEN** at least one `docs/features/<feature-id>` directory is missing
- **THEN** the command exits with an error
- **AND** it points the user to `lv bootstrap <feature-id> --paths <paths>`

### Requirement: Create ticket branch
The command SHALL create a Git branch for the ticket from the configured default branch.

#### Scenario: Branch creation succeeds
- **WHEN** the command reaches branch creation
- **THEN** it checks out `config.default_branch`
- **AND** creates the ticket branch from that branch

### Requirement: Render branch name
The command SHALL name the ticket branch using the configured branch type, ticket ID, and ticket title slug.

#### Scenario: Known branch type is provided
- **WHEN** the user passes `--type <type>` and the type exists in configuration or the built-in defaults
- **THEN** the branch name is rendered from that pattern

#### Scenario: No branch type is provided
- **WHEN** the user omits `--type`
- **THEN** the command uses `default_branch_type`

#### Scenario: Title is unavailable
- **WHEN** the configured title field is empty for the ticket
- **THEN** the branch name falls back to the ticket ID for the summary portion

### Requirement: Generate analysis draft
The command SHALL generate the initial analysis document for the ticket after the branch is created.

#### Scenario: Analysis generation runs
- **GIVEN** the ticket has at least one feature ID and all feature docs exist
- **WHEN** the command reaches the analysis step
- **THEN** it builds the analysis prompt from the ticket and feature docs
- **AND** it writes the generated Markdown to `docs/changes/<ticket-id>/1.proposal.md`

### Requirement: Persist workflow state
The command SHALL write ticket workflow state to `docs/changes/<ticket-id>/state.yaml` after generating the analysis draft.

#### Scenario: Start state is written
- **WHEN** analysis generation completes
- **THEN** the state file records the ticket ID, feature IDs, branch, creation time, CLI version, and analysis step metadata
- **AND** `current_step` is `analysis`
- **AND** `steps.analysis.status` is `in_progress`

### Requirement: Commit and push changes
The command SHALL commit the generated work and attempt to push the new branch.

#### Scenario: Commit succeeds
- **WHEN** the command finishes writing the analysis file and state file
- **THEN** it commits the repository changes with a ticket start message

#### Scenario: Push succeeds
- **WHEN** the commit is created and a remote is available
- **THEN** the command pushes the branch to `origin`
- **AND** it reports success

#### Scenario: Push fails
- **WHEN** the push cannot be completed
- **THEN** the command reports the failure
- **AND** it keeps the commit locally

### Requirement: Surface completion path
The command SHALL print the generated analysis file path when it finishes successfully.

#### Scenario: Start completes
- **WHEN** all required steps finish successfully
- **THEN** the command prints the path to `docs/changes/<ticket-id>/1.proposal.md`
- **AND** it tells the user to review the document and run `lv answer` next