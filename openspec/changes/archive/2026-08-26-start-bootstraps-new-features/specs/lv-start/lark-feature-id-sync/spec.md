## Purpose

Keeps a newly allocated feature ID connected to its originating Lark ticket, so later `lv start` runs for the same feature recognize it instead of allocating a duplicate.

## ADDED Requirements

### Requirement: Sync is configurable, enabled by default
The system SHALL provide a configuration setting controlling whether a newly allocated feature ID is written back to the originating ticket in Lark Base, defaulting to enabled.

#### Scenario: Default configuration syncs automatically
- **WHEN** a new feature ID is allocated during `lv start` and no sync configuration is set
- **THEN** the system writes the allocated ID back to the ticket's Feature ID field in Lark Base without prompting

### Requirement: Sync can be disabled
The system SHALL skip the Lark write-back when the sync configuration setting is explicitly disabled.

#### Scenario: Sync disabled via configuration
- **WHEN** the sync configuration setting is explicitly disabled
- **THEN** the system does not write the allocated feature ID back to Lark, and the ticket's Feature ID field remains unchanged

### Requirement: Write preserves field shape and existing values
The system SHALL preserve the Feature ID field's existing representation (single string or list) and append the new ID rather than overwrite the field's existing content.

#### Scenario: Ticket already references another feature
- **WHEN** a ticket's Feature ID field already lists one feature and a second feature is newly allocated
- **THEN** syncing back to Lark adds the new ID to the field's existing value without removing the first ID, and preserves the field's original string-or-array representation

### Requirement: Sync failures don't block the ticket start
The system SHALL NOT fail the `lv start` command if the Lark write-back fails.

#### Scenario: Lark write fails
- **WHEN** the write-back to Lark Base fails, for example due to insufficient permission scope or a network error
- **THEN** `lv start` reports the failure but continues, completing the branch, analysis, and commit as if sync were disabled
