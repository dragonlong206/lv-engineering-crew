## Purpose

Keeps `docs/features/<id>/` from silently drifting out of sync with the code it describes by having `lv init` configure the OpenSpec workflow to prompt for a refresh at the two points where a change's behavior becomes "official" — archive and manual spec sync.

## Requirements

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
The system SHALL state, in the project context made available to OpenSpec workflows, that an engineer syncing delta specs to main specs outside of an archive should also refresh the docs of any feature the change touches — without any automated mechanism checking or enforcing that this happens. This stated convention SHALL point at an invocation that actually succeeds under the current `lv bootstrap` CLI contract (the `lv-bootstrap` skill/command), not a bare `lv bootstrap <feature-id>` call.

#### Scenario: Engineer runs a manual sync
- **WHEN** an engineer syncs a change's delta specs to main specs without archiving the change
- **THEN** the project context they have available states that touched features' docs should be refreshed, and no part of the system verifies or blocks on whether they did so

#### Scenario: Stated convention references a working invocation
- **WHEN** an engineer follows the manual-sync convention's feature-doc-refresh instruction for a feature ID
- **THEN** the instructed invocation succeeds in generating or refining that feature's docs, rather than erroring

### Requirement: Previously-installed guidance is upgraded when its wording changes
The system SHALL, when the step that configures the archive guidance or the manual-sync convention runs on a project whose OpenSpec configuration already carries an earlier version of that guidance's wording, replace the outdated wording with the current wording in place — rather than leaving the outdated wording untouched, or appending the current wording alongside it as a second, duplicate entry.

#### Scenario: Re-running the configuring step after the guidance wording changed
- **WHEN** the step that configures archive guidance or the manual-sync convention runs on a project already configured with an earlier version of that text
- **THEN** the OpenSpec configuration ends up with exactly one copy of the guidance, using the current wording, with no trace of the outdated wording left alongside it

#### Scenario: Re-running the configuring step with no wording change
- **WHEN** the step that configures archive guidance or the manual-sync convention runs on a project already configured with the current wording
- **THEN** the OpenSpec configuration is left unchanged, as already covered by the existing idempotency requirement for archive guidance

### Requirement: Malformed previously-installed guidance is repaired
The system SHALL repair malformed guidance when the step that configures the archive guidance runs on a project whose OpenSpec configuration has a guidance item written in a form OpenSpec rejects. The case covered is an item intended as text but stored so that it is read as a key/value pair rather than a string. The repair SHALL recover the text that item was meant to hold, and SHALL leave the configuration so that OpenSpec accepts the whole guidance list without a warning. Specifically:
- If the recovered text is an earlier version of LV's archive guidance wording, the system SHALL replace it with the current wording, or remove it if the current wording is already present, so exactly one copy of the current wording remains.
- If the recovered text is not LV's wording, the system SHALL keep it as a valid text item instead of discarding it.

The system SHALL tell the engineer when it has made such a repair.

#### Scenario: Only a malformed legacy item is present
- **WHEN** the configuring step runs on a project whose archive guidance holds a single malformed item carrying an earlier version of LV's wording
- **THEN** the archive guidance ends up holding exactly one valid item with the current wording, and nothing of the malformed item remains

#### Scenario: Malformed legacy item alongside the current wording
- **WHEN** the configuring step runs on a project whose archive guidance holds a malformed item carrying an earlier version of LV's wording, plus a valid item already carrying the current wording
- **THEN** the archive guidance ends up holding exactly one valid item with the current wording, and the malformed item is removed

#### Scenario: Repaired guidance is accepted by OpenSpec
- **WHEN** an engineer requests archive instructions for a change after the configuring step has repaired the project's archive guidance
- **THEN** OpenSpec returns the archive guidance with LV's current wording and reports no warning about the guidance being invalid or discarded

#### Scenario: Malformed item that is not LV's wording
- **WHEN** the configuring step runs on a project whose archive guidance holds a malformed item whose recovered text is not any version of LV's wording
- **THEN** that text is kept as a valid guidance item, and LV's current wording is added alongside it exactly once

#### Scenario: Engineer is told about the repair
- **WHEN** the configuring step repairs one or more malformed guidance items
- **THEN** the engineer sees a notice that the OpenSpec configuration's guidance was repaired

#### Scenario: Nothing malformed
- **WHEN** the configuring step runs on a project whose archive guidance has only valid text items
- **THEN** no repair notice is shown, and the existing idempotency and wording-upgrade behavior applies unchanged
