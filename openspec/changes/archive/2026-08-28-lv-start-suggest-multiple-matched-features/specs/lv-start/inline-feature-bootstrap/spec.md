## MODIFIED Requirements

### Requirement: Empty or missing feature reference is matched against existing features first
The system SHALL, before treating an empty Feature ID (ticket mode) or an unset feature reference (description mode) as a brand-new feature, compare the change's title/description against every existing feature that has non-empty docs and present every existing feature that is clearly a match, if any, for the engineer to confirm — the change may match more than one existing feature, not just the single best guess.

#### Scenario: Ticket mode — a match is found and confirmed
- **WHEN** `lv start` is run for a ticket whose Feature ID field is empty, exactly one existing feature is suggested as a match, and the engineer confirms it
- **THEN** the system uses that feature's ID for the ticket without allocating a new one or regenerating its docs

#### Scenario: Ticket mode — multiple matches are found and all confirmed
- **WHEN** `lv start` is run for a ticket whose Feature ID field is empty, and more than one existing feature is suggested as a match
- **THEN** the system presents every suggested feature together, and upon the engineer confirming all of them, uses all of their IDs for the ticket without allocating a new one or regenerating docs for any of them

#### Scenario: Ticket mode — multiple matches are found and only some confirmed
- **WHEN** `lv start` is run for a ticket whose Feature ID field is empty, more than one existing feature is suggested as a match, and the engineer confirms only a subset of them
- **THEN** the system uses only the confirmed subset's IDs for the ticket, without allocating a new one or regenerating docs for any of them

#### Scenario: Description mode — a match is found and confirmed
- **WHEN** `lv start` is run with `--description` and the engineer confirms one or more suggested existing features as matches
- **THEN** the system records all confirmed features' IDs in `feature_ids` instead of leaving it empty

#### Scenario: Description mode — no match found or declined
- **WHEN** `lv start` is run with `--description`, and either no existing feature was suggested or the engineer declined every suggested match
- **THEN** the system leaves `feature_ids` empty, as it did before this capability existed

#### Scenario: No existing features have docs yet
- **WHEN** `lv start` is run (either mode) and no existing feature directory has non-empty docs to compare against
- **THEN** the system skips the match step entirely — no comparison is attempted and no confirmation prompt is shown

### Requirement: Empty Feature ID allocates one or more new features
The system SHALL, when a ticket's Feature ID field is empty and the engineer confirmed none of the suggested existing-feature matches (or none were suggested), infer from the ticket's title and description how many distinct new features are implied (with a suggested title for each), present that inferred set to the engineer for confirmation or adjustment, and then allocate a new feature ID for each confirmed feature — rather than always allocating exactly one.

#### Scenario: Ticket implies a single feature
- **WHEN** `lv start` is run for a ticket whose Feature ID field is empty, no existing-feature match was confirmed, and the inferred set contains exactly one feature
- **THEN** the system allocates one new feature ID after the engineer confirms, and proceeds to generate that feature's docs — matching prior single-feature behavior

#### Scenario: Ticket implies multiple distinct features
- **WHEN** `lv start` is run for a ticket whose Feature ID field is empty, no existing-feature match was confirmed, and the inferred set contains more than one feature
- **THEN** the system presents the inferred features to the engineer, and upon confirmation allocates a new feature ID for each one and generates docs for each

#### Scenario: Engineer adjusts the inferred set
- **WHEN** the engineer is presented with the inferred set of new features and changes it — adding, removing, or editing an entry — before confirming
- **THEN** the system allocates new feature IDs only for the engineer-confirmed set, not the originally inferred one
