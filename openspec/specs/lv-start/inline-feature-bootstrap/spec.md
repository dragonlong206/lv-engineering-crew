## Purpose

Lets `lv start` create a brand-new feature's docs on the fly when a ticket references a feature that doesn't exist yet, instead of requiring a separate manual bootstrap step before the ticket can be started.

## Requirements

### Requirement: Missing feature directory triggers inline bootstrap
The system SHALL, for each feature ID referenced by a ticket, generate that feature's docs automatically when no `docs/features/<id>/` directory exists, instead of exiting with an error.

#### Scenario: Ticket references a feature with no existing docs directory
- **WHEN** `lv start` is run for a ticket whose Feature ID field lists an ID with no `docs/features/<id>/` directory on disk
- **THEN** the system generates that feature's docs using the ticket's title and description as context, without exiting with an error

### Requirement: Empty Feature ID allocates a new feature
The system SHALL allocate a new feature ID when a ticket's Feature ID field is empty and no existing feature was confirmed as a match, rather than exiting with an error.

#### Scenario: Ticket has no Feature ID set
- **WHEN** `lv start` is run for a ticket whose Feature ID field is empty, and either no existing feature was suggested or the engineer declined the suggested match
- **THEN** the system allocates a new feature ID and proceeds to generate that feature's docs

### Requirement: Empty or missing feature reference is matched against existing features first
The system SHALL, before treating an empty Feature ID (ticket mode) or an unset feature reference (description mode) as a brand-new feature, compare the change's title/description against every existing feature that has non-empty docs and offer the best match, if any, for the engineer to confirm.

#### Scenario: Ticket mode — a match is found and confirmed
- **WHEN** `lv start` is run for a ticket whose Feature ID field is empty, and the engineer confirms a suggested existing feature as a match
- **THEN** the system uses that feature's ID for the ticket without allocating a new one or regenerating its docs

#### Scenario: Description mode — a match is found and confirmed
- **WHEN** `lv start` is run with `--description` and the engineer confirms a suggested existing feature as a match
- **THEN** the system records that feature's ID in `feature_ids` instead of leaving it empty

#### Scenario: Description mode — no match found or declined
- **WHEN** `lv start` is run with `--description`, and either no existing feature was suggested or the engineer declined the suggested match
- **THEN** the system leaves `feature_ids` empty, as it did before this capability existed

#### Scenario: No existing features have docs yet
- **WHEN** `lv start` is run (either mode) and no existing feature directory has non-empty docs to compare against
- **THEN** the system skips the match step entirely — no comparison is attempted and no confirmation prompt is shown

### Requirement: Human review gate before branch creation
The system SHALL pause and require explicit human confirmation after generating a new feature's docs, before creating the ticket's branch.

#### Scenario: User confirms after reviewing generated docs
- **WHEN** the system has generated a new feature's docs and displayed their file paths
- **THEN** it prompts the user to confirm before continuing, and only creates the ticket branch after the user confirms

#### Scenario: User declines to continue
- **WHEN** the user declines the confirmation prompt after feature docs are generated
- **THEN** the system stops without creating a branch or making any commit, leaving the generated docs on disk uncommitted

### Requirement: Declined runs are resumable without regenerating docs
The system SHALL treat an existing `docs/features/<id>/` directory as sufficient to skip inline generation on a later run, regardless of whether it was created by a prior run's declined confirmation.

#### Scenario: Re-running start after a prior decline
- **WHEN** `lv start` is run again for a ticket whose feature directory was created, but not committed, by a previous run that was declined
- **THEN** the system does not regenerate the feature docs and proceeds directly to branch creation

### Requirement: Reviewed feature docs are committed with the ticket
The system SHALL include newly generated feature docs in the same commit as the ticket's branch setup, once the user has confirmed to continue.

#### Scenario: Confirmed feature docs ship in the start commit
- **WHEN** the user confirms to continue after reviewing generated feature docs
- **THEN** the commit created at the end of `lv start` includes those feature docs alongside the state file — there is no analysis document to include, since `lv start` no longer generates one
