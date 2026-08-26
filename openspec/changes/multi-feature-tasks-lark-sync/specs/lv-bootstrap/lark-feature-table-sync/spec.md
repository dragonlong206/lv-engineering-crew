## Purpose

Registers every newly created feature in a dedicated Lark Base Features table, so stakeholders in Lark can see which features exist and which ticket introduced each one, without manual data entry.

## ADDED Requirements

### Requirement: New feature docs generation creates a Lark Features table record
The system SHALL create a record in the configured Lark Base Features table when a feature's docs directory (`docs/features/<feature-id>/`) does not exist prior to a docs-generation run, whether that run was triggered directly by `lv bootstrap <feature-id>` or by `lv start`'s inline bootstrap.

#### Scenario: lv bootstrap creates docs for a brand-new feature ID
- **WHEN** `lv bootstrap <feature-id>` is run for a feature ID with no existing `docs/features/<feature-id>/` directory
- **THEN** after docs are generated, the system creates a record for that feature ID in the configured Lark Base Features table

#### Scenario: lv start's inline bootstrap creates docs for a brand-new feature ID
- **WHEN** `lv start`'s inline feature bootstrap generates docs for a feature ID with no existing `docs/features/<feature-id>/` directory
- **THEN** after docs are generated, the system creates a record for that feature ID in the configured Lark Base Features table

### Requirement: Existing feature docs are not re-synced
The system SHALL NOT create or update a Features table record when a feature's docs directory already existed before the run, since that run is a refresh/refinement rather than the creation of a new feature.

#### Scenario: lv bootstrap refines an existing feature's docs
- **WHEN** `lv bootstrap <feature-id>` is run for a feature ID whose `docs/features/<feature-id>/` directory already exists
- **THEN** the system does not create or update any record in the Lark Features table

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
