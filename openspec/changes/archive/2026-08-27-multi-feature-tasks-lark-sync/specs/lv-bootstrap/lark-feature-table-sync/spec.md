## Purpose

Registers every newly created feature in a dedicated Lark Base Features table, so stakeholders in Lark can see which features exist and which ticket introduced each one, without manual data entry.

## ADDED Requirements

### Requirement: Docs generation creates a Lark Features table record when one is missing
The system SHALL create a record in the configured Lark Base Features table for a feature ID whenever docs generation runs for it — via `lv bootstrap <feature-id>` or `lv start`'s inline bootstrap — and that feature ID has no existing record in the table yet, regardless of whether its `docs/features/<feature-id>/` directory already existed locally. Existence is determined by checking the Features table itself, not by local docs-directory presence, so a feature whose docs were generated before the sync was configured (or whose prior sync attempt failed) is backfilled on a later run instead of being skipped forever.

#### Scenario: lv bootstrap creates docs for a brand-new feature ID
- **WHEN** `lv bootstrap <feature-id>` is run for a feature ID with no existing `docs/features/<feature-id>/` directory and no existing Features table record
- **THEN** after docs are generated, the system creates a record for that feature ID in the configured Lark Base Features table

#### Scenario: lv start's inline bootstrap creates docs for a brand-new feature ID
- **WHEN** `lv start`'s inline feature bootstrap generates docs for a feature ID with no existing `docs/features/<feature-id>/` directory and no existing Features table record
- **THEN** after docs are generated, the system creates a record for that feature ID in the configured Lark Base Features table

#### Scenario: Existing docs directory but a missing Features table record is backfilled
- **WHEN** `lv bootstrap <feature-id>` or `lv start` runs for a feature ID whose `docs/features/<feature-id>/` directory already exists locally, but the configured Lark Features table has no record for that feature ID
- **THEN** the system creates a record for that feature ID in the Features table

### Requirement: A feature already recorded in the Features table is not duplicated
The system SHALL NOT create a second Features table record for a feature ID that already has one there.

#### Scenario: lv bootstrap refines an already-synced feature's docs
- **WHEN** `lv bootstrap <feature-id>` is run for a feature ID that already has a record in the Lark Features table
- **THEN** the system does not create a duplicate record in the Features table

### Requirement: Record includes feature ID, title, and originating ticket link
The system SHALL populate the created Features table record with the feature ID, a title, and — when the docs were generated in the context of a ticket — a reference back to that ticket.

#### Scenario: Feature created via lv start for a ticket
- **WHEN** a new feature is created as part of `lv start <ticket-id>`
- **THEN** the created Features table record includes the feature ID, a title, and a reference to the originating ticket

#### Scenario: Feature created via lv bootstrap with no ticket context
- **WHEN** a new feature is created by running `lv bootstrap <feature-id>` directly, outside of any `lv start` run
- **THEN** the created Features table record includes the feature ID and a title, with no ticket reference

### Requirement: Sync is configurable and best-effort
The system SHALL provide a configuration setting controlling whether new features are synced to the Lark Features table, and SHALL NOT fail the invoking command if the sync fails.

#### Scenario: Sync disabled via configuration
- **WHEN** the Features table sync setting is explicitly disabled
- **THEN** the system does not attempt to create a Features table record for any newly created feature

#### Scenario: Lark write fails
- **WHEN** creating the Features table record fails, for example due to insufficient permission scope or a network error
- **THEN** the invoking command reports the failure but completes as if sync were disabled
