## Purpose

Keeps `docs/features/<id>/` from silently drifting out of sync with the code it describes by having `lv init` configure the OpenSpec workflow to prompt for a refresh at the two points where a change's behavior becomes "official" — archive and manual spec sync.

## Requirements

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

### Requirement: Archive-time doc-refresh guidance is advisory, not blocking
The system SHALL NOT prevent or fail an archive solely because the feature-doc refresh it recommends was not performed.

#### Scenario: Archive completes without a refresh
- **WHEN** an engineer archives a change without regenerating any touched feature's docs
- **THEN** the archive still completes successfully

### Requirement: Configuring the archive guidance is idempotent
The system SHALL result in exactly one copy of the feature-doc-refresh guidance in the OpenSpec configuration no matter how many times the configuring step runs.

#### Scenario: Configuring step runs more than once
- **WHEN** the step that configures archive guidance runs again on a project already configured with it
- **THEN** the OpenSpec configuration ends up with exactly one copy of the guidance, not a duplicate

### Requirement: Manual spec sync carries a documented, unenforced refresh convention
The system SHALL state, in the project context made available to OpenSpec workflows, that an engineer syncing delta specs to main specs outside of an archive should also refresh the docs of any feature the change touches — without any automated mechanism checking or enforcing that this happens.

#### Scenario: Engineer runs a manual sync
- **WHEN** an engineer syncs a change's delta specs to main specs without archiving the change
- **THEN** the project context they have available states that touched features' docs should be refreshed, and no part of the system verifies or blocks on whether they did so
