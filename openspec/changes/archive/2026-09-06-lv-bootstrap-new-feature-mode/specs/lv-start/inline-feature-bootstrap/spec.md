## MODIFIED Requirements

### Requirement: Missing feature directory triggers inline bootstrap
The system SHALL, for each feature ID referenced by a ticket, generate that feature's docs automatically in new-feature placeholder mode when no `docs/features/<id>/` directory exists, instead of exiting with an error or running autonomous codebase exploration.

#### Scenario: Ticket references a feature with no existing docs directory
- **WHEN** `lv start` is run for a ticket whose Feature ID field lists an ID with no `docs/features/<id>/` directory on disk
- **THEN** the system generates that feature's docs in new-feature placeholder mode, without scanning the repository and without exiting with an error
