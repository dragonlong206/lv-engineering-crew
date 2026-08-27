## Purpose

Keeps a ticket's status in Lark Base in sync with the fact that work on it has started, so engineers don't have to manually flip it to "In Dev" after running `lv start`.

## Requirements

### Requirement: Sync is configurable, enabled by default
The system SHALL provide a configuration setting controlling whether `lv start` writes an "in dev" status back to the originating ticket in Lark Base, defaulting to enabled.

#### Scenario: Default configuration syncs automatically
- **WHEN** `lv start <ticket-id>` runs and no status-sync configuration is set
- **THEN** the system writes the configured "in dev" value to the ticket's status field in Lark Base without prompting

### Requirement: Sync can be disabled
The system SHALL skip the status write-back when the status-sync configuration setting is explicitly disabled.

#### Scenario: Sync disabled via configuration
- **WHEN** the status-sync configuration setting is explicitly disabled
- **THEN** the system does not write to the ticket's status field, and the field remains unchanged

### Requirement: Write is skipped when the ticket is already in the target status
The system SHALL only write the "in dev" status value when the ticket's current status differs from it.

#### Scenario: Ticket already in the target status
- **WHEN** the ticket's status field already equals the configured "in dev" value
- **THEN** `lv start` does not issue a write to Lark for the status field

#### Scenario: Ticket in a different status
- **WHEN** the ticket's status field holds a value other than the configured "in dev" value
- **THEN** `lv start` writes the configured "in dev" value to the ticket's status field in Lark Base

### Requirement: The target status value and field name are configurable
The system SHALL allow the status field's column name and the "in dev" target value to be configured, each with a default.

#### Scenario: No configuration given
- **WHEN** no status field name or target value is configured
- **THEN** the system reads and writes a field named "Status" and treats "In Dev" as the target value

### Requirement: Sync failures don't block the ticket start
The system SHALL NOT fail the `lv start` command if the status write-back fails.

#### Scenario: Lark write fails
- **WHEN** the write-back of the ticket's status to Lark Base fails, for example due to insufficient permission scope or a network error
- **THEN** `lv start` reports the failure but continues, completing the branch, state, and commit as if sync were disabled

### Requirement: Description-based starts are unaffected
The system SHALL NOT attempt a status write-back for a change started without a Lark ticket.

#### Scenario: Description-based start
- **WHEN** `lv start --description "..."` is used instead of a ticket ID
- **THEN** the system does not attempt to read or write any ticket status field
