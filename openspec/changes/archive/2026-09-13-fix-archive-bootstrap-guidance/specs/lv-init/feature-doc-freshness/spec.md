## MODIFIED Requirements

### Requirement: Archive workflow is configured to prompt a feature-doc refresh
The system SHALL configure the installed OpenSpec archive workflow so that its guidance instructs regenerating a feature's docs before the archive completes for: each feature ID recorded against the change being archived; and, when the change has no recorded feature IDs, each existing `docs/features/<id>/` directory whose id matches the leading path segment of one of the change's delta spec capability paths. The instructed method SHALL be one that actually succeeds under the current `lv bootstrap` CLI contract — invoking the `lv-bootstrap` skill/command for the feature ID — not a bare `lv bootstrap <feature-id>` call, which errors instead of regenerating anything once `lv bootstrap` requires an explicit mode flag.

#### Scenario: Archiving a change that touches one or more features
- **WHEN** an engineer archives a change whose recorded context lists one or more feature IDs
- **THEN** the archive workflow's guidance instructs refreshing each listed feature's docs before the archive completes

#### Scenario: Archiving a change that touches no features
- **WHEN** an engineer archives a change whose recorded context lists no feature IDs, and no delta spec capability path matches an existing feature directory
- **THEN** the archive workflow's guidance has nothing feature-specific to instruct, and archiving proceeds normally

#### Scenario: Archiving a change with no recorded feature IDs but a matching capability path
- **WHEN** an engineer archives a change with no recorded feature IDs, and one of its delta spec capability paths has a leading segment matching an existing `docs/features/<id>/` directory
- **THEN** the archive workflow's guidance instructs refreshing that feature's docs before the archive completes

#### Scenario: Guidance references a working invocation
- **WHEN** an engineer follows the archive workflow's feature-doc-refresh guidance for a feature ID
- **THEN** the instructed invocation succeeds in generating or refining that feature's docs, rather than erroring because the guidance names an invocation `lv bootstrap`'s current CLI no longer supports without a mode flag

### Requirement: Manual spec sync carries a documented, unenforced refresh convention
The system SHALL state, in the project context made available to OpenSpec workflows, that an engineer syncing delta specs to main specs outside of an archive should also refresh the docs of any feature the change touches — without any automated mechanism checking or enforcing that this happens. This stated convention SHALL point at an invocation that actually succeeds under the current `lv bootstrap` CLI contract (the `lv-bootstrap` skill/command), not a bare `lv bootstrap <feature-id>` call.

#### Scenario: Engineer runs a manual sync
- **WHEN** an engineer syncs a change's delta specs to main specs without archiving the change
- **THEN** the project context they have available states that touched features' docs should be refreshed, and no part of the system verifies or blocks on whether they did so

#### Scenario: Stated convention references a working invocation
- **WHEN** an engineer follows the manual-sync convention's feature-doc-refresh instruction for a feature ID
- **THEN** the instructed invocation succeeds in generating or refining that feature's docs, rather than erroring

## ADDED Requirements

### Requirement: Previously-installed guidance is upgraded when its wording changes
The system SHALL, when the step that configures the archive guidance or the manual-sync convention runs on a project whose OpenSpec configuration already carries an earlier version of that guidance's wording, replace the outdated wording with the current wording in place — rather than leaving the outdated wording untouched, or appending the current wording alongside it as a second, duplicate entry.

#### Scenario: Re-running the configuring step after the guidance wording changed
- **WHEN** the step that configures archive guidance or the manual-sync convention runs on a project already configured with an earlier version of that text
- **THEN** the OpenSpec configuration ends up with exactly one copy of the guidance, using the current wording, with no trace of the outdated wording left alongside it

#### Scenario: Re-running the configuring step with no wording change
- **WHEN** the step that configures archive guidance or the manual-sync convention runs on a project already configured with the current wording
- **THEN** the OpenSpec configuration is left unchanged, as already covered by the existing idempotency requirement for archive guidance
