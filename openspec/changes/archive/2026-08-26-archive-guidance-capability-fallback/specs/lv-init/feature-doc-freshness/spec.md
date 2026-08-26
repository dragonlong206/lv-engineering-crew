## MODIFIED Requirements

### Requirement: Archive workflow is configured to prompt a feature-doc refresh
The system SHALL configure the installed OpenSpec archive workflow so that its guidance instructs regenerating a feature's docs before the archive completes for: each feature ID recorded against the change being archived; and, when the change has no recorded feature IDs, each existing `docs/features/<id>/` directory whose id matches the leading path segment of one of the change's delta spec capability paths.

#### Scenario: Archiving a change that touches one or more features
- **WHEN** an engineer archives a change whose recorded context lists one or more feature IDs
- **THEN** the archive workflow's guidance instructs refreshing each listed feature's docs before the archive completes

#### Scenario: Archiving a change that touches no features
- **WHEN** an engineer archives a change whose recorded context lists no feature IDs, and no delta spec capability path matches an existing feature directory
- **THEN** the archive workflow's guidance has nothing feature-specific to instruct, and archiving proceeds normally

#### Scenario: Archiving a change with no recorded feature IDs but a matching capability path
- **WHEN** an engineer archives a change with no recorded feature IDs, and one of its delta spec capability paths has a leading segment matching an existing `docs/features/<id>/` directory
- **THEN** the archive workflow's guidance instructs refreshing that feature's docs before the archive completes
