## MODIFIED Requirements

### Requirement: Empty Feature ID allocates a new feature
The system SHALL allocate a new feature ID when a ticket's Feature ID field is empty and no existing feature was confirmed as a match, rather than exiting with an error.

#### Scenario: Ticket has no Feature ID set
- **WHEN** `lv start` is run for a ticket whose Feature ID field is empty, and either no existing feature was suggested or the engineer declined the suggested match
- **THEN** the system allocates a new feature ID and proceeds to generate that feature's docs

## ADDED Requirements

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
