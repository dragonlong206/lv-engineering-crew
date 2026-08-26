## MODIFIED Requirements

### Requirement: Reviewed feature docs are committed with the ticket
The system SHALL include newly generated feature docs in the same commit as the ticket's branch setup, once the user has confirmed to continue.

#### Scenario: Confirmed feature docs ship in the start commit
- **WHEN** the user confirms to continue after reviewing generated feature docs
- **THEN** the commit created at the end of `lv start` includes those feature docs alongside the state file — there is no analysis document to include, since `lv start` no longer generates one
