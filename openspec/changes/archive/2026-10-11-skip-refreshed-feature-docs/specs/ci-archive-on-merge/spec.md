## MODIFIED Requirements

### Requirement: Headless feature doc refresh
After archiving a change, the system SHALL refresh `docs/features/<id>/{overview.md,design.md}` for every feature ID recorded in the merged branch's `state.yaml` `feature_ids` that is not also listed in its `refreshed_features`, by invoking the `lv-bootstrap` skill through a headlessly-run coding agent authenticated with a long-lived credential (not an interactive login). Features listed in `refreshed_features` SHALL be skipped, leaving their docs untouched.

#### Scenario: Feature docs refreshed for every touched feature
- **WHEN** the merged branch's `state.yaml` lists one or more `feature_ids` and none appear in `refreshed_features`
- **THEN** the system invokes the `lv-bootstrap` skill for each listed feature ID and commits the resulting changes to `docs/features/<id>/overview.md` and `docs/features/<id>/design.md`, if any

#### Scenario: Already-refreshed feature is skipped
- **WHEN** a `feature_ids` entry also appears in `refreshed_features`
- **THEN** the system does not invoke the `lv-bootstrap` skill for that feature and does not modify its docs

#### Scenario: Mix of refreshed and unrefreshed features
- **WHEN** `feature_ids` lists several features and only some appear in `refreshed_features`
- **THEN** the system refreshes only the features not listed in `refreshed_features`

#### Scenario: All features already refreshed
- **WHEN** every `feature_ids` entry appears in `refreshed_features`
- **THEN** the system skips the build and headless refresh steps, while still archiving the linked OpenSpec change(s)

#### Scenario: Authentication failure is surfaced, not silently skipped
- **WHEN** the headless coding agent's long-lived credential is missing, expired, or otherwise invalid, and at least one feature needs refreshing
- **THEN** the system fails the run visibly (a failed CI run) rather than silently completing the archive without refreshing feature docs
