# feature-docs-refreshed-marker Specification

## Purpose

Records, in a change's `state.yaml`, which features' docs `lv bootstrap --finalize` has already refreshed on the change's branch, so the archive-on-merge pipeline can skip regenerating them.

## Requirements

### Requirement: Finalize records the feature as refreshed for the current change
When `lv bootstrap <feature-id> --finalize` succeeds on a branch that matches a configured change branch type and whose `docs/changes/<change-id>/state.yaml` exists, the system SHALL add `<feature-id>` to that state's `refreshed_features` list. Recording SHALL be idempotent.

#### Scenario: Finalize on a change branch
- **WHEN** an engineer finalizes a feature's docs while on a change branch with a `state.yaml`
- **THEN** that `state.yaml`'s `refreshed_features` contains the feature ID

#### Scenario: Finalize run more than once
- **WHEN** finalize runs again for a feature already listed in `refreshed_features`
- **THEN** the list still contains the feature ID exactly once

### Requirement: Recording the marker never blocks finalize
The system SHALL NOT fail `--finalize` because the marker could not be recorded.

#### Scenario: Finalize off a change branch
- **WHEN** finalize runs on a branch that matches no change branch type, or whose change has no `state.yaml`
- **THEN** finalize still completes successfully and no `state.yaml` is modified

### Requirement: Existing state files remain valid
`refreshed_features` SHALL be optional; a `state.yaml` without it SHALL be treated as having no refreshed features.

#### Scenario: Legacy state.yaml
- **WHEN** a `state.yaml` written before this field existed is read
- **THEN** it parses successfully and no feature is considered refreshed
