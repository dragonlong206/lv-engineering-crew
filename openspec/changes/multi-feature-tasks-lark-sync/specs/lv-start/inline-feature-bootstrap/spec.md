## MODIFIED Requirements

### Requirement: Empty Feature ID allocates one or more new features
The system SHALL, when a ticket's Feature ID field is empty and no existing feature was confirmed as a match, infer from the ticket's title and description how many distinct new features are implied (with a suggested title for each), present that inferred set to the engineer for confirmation or adjustment, and then allocate a new feature ID for each confirmed feature — rather than always allocating exactly one.

#### Scenario: Ticket implies a single feature
- **WHEN** `lv start` is run for a ticket whose Feature ID field is empty, either no existing feature was suggested or the engineer declined the suggested match, and the inferred set contains exactly one feature
- **THEN** the system allocates one new feature ID after the engineer confirms, and proceeds to generate that feature's docs — matching prior single-feature behavior

#### Scenario: Ticket implies multiple distinct features
- **WHEN** `lv start` is run for a ticket whose Feature ID field is empty, either no existing feature was suggested or the engineer declined the suggested match, and the inferred set contains more than one feature
- **THEN** the system presents the inferred features to the engineer, and upon confirmation allocates a new feature ID for each one and generates docs for each

#### Scenario: Engineer adjusts the inferred set
- **WHEN** the engineer is presented with the inferred set of new features and changes it — adding, removing, or editing an entry — before confirming
- **THEN** the system allocates new feature IDs only for the engineer-confirmed set, not the originally inferred one
