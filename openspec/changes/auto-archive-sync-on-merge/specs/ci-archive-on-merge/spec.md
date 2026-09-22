## Purpose

Automatically archives a merged PR's linked OpenSpec change(s) and refreshes the feature docs it touched, on merge, without an engineer having to run the manual archive step themselves.

## ADDED Requirements

### Requirement: Merge-triggered resolution and archive
When a pull request is merged into the default branch, the system SHALL resolve the merged branch to its `docs/changes/<change-id>/state.yaml` and run OpenSpec's non-interactive archive for every OpenSpec change name recorded in that state's `openspec_changes`.

#### Scenario: Single linked change archived on merge
- **WHEN** a PR whose source branch matches a `docs/changes/<change-id>/state.yaml` with one entry in `openspec_changes` is merged into the default branch
- **THEN** the system runs OpenSpec's archive for that change without prompting for confirmation, syncing its delta specs into the main specs under `openspec/specs/`

#### Scenario: Multiple linked changes archived on merge
- **WHEN** the merged branch's `state.yaml` lists more than one entry in `openspec_changes`
- **THEN** the system archives each listed change

### Requirement: Graceful no-op for untracked branches
When a merged PR's source branch has no matching `docs/changes/<change-id>/state.yaml`, or that state has an empty `openspec_changes`, the system SHALL complete without error and take no archive or doc-refresh action.

#### Scenario: Merged branch not created via `lv start`
- **WHEN** a PR is merged whose source branch does not match any `docs/changes/<change-id>/state.yaml`'s `branch` field
- **THEN** the system completes successfully and performs no archive or doc-refresh action

#### Scenario: Linked state has no OpenSpec changes yet
- **WHEN** the merged branch's `state.yaml` exists but its `openspec_changes` list is empty
- **THEN** the system completes successfully and performs no archive or doc-refresh action

### Requirement: Idempotent re-run
When an OpenSpec change listed in `openspec_changes` is already archived, the system SHALL skip re-archiving it rather than failing the run.

#### Scenario: Workflow re-run after a partial failure
- **WHEN** the system re-runs (e.g. after a prior run failed partway through) and one of the linked changes was already archived in a previous run
- **THEN** the system skips archiving that already-archived change and continues with the rest of the run

### Requirement: Headless feature doc refresh
After archiving a change, the system SHALL refresh `docs/features/<id>/{overview.md,design.md}` for every feature ID recorded in the merged branch's `state.yaml` `feature_ids`, by invoking the `lv-bootstrap` skill through a headlessly-run coding agent authenticated with a long-lived credential (not an interactive login).

#### Scenario: Feature docs refreshed for every touched feature
- **WHEN** the merged branch's `state.yaml` lists one or more `feature_ids`
- **THEN** the system invokes the `lv-bootstrap` skill for each listed feature ID and commits the resulting changes to `docs/features/<id>/overview.md` and `docs/features/<id>/design.md`, if any

#### Scenario: Authentication failure is surfaced, not silently skipped
- **WHEN** the headless coding agent's long-lived credential is missing, expired, or otherwise invalid
- **THEN** the system fails the run visibly (a failed CI run) rather than silently completing the archive without refreshing feature docs

### Requirement: Pinned OpenSpec CLI version in CI
The system SHALL install the OpenSpec CLI in the CI runner pinned to a specific, documented version rather than resolving to whatever the latest published version is at run time.

#### Scenario: Runner installs the documented pinned version
- **WHEN** the archive workflow runs
- **THEN** it installs the OpenSpec CLI version documented in the repository's setup guide, not an unpinned `latest` resolution

### Requirement: Direct commit of archived results
The system SHALL commit the archived OpenSpec state and any refreshed feature docs directly to the default branch after a successful run.

#### Scenario: Archive and doc-refresh results are committed
- **WHEN** archiving and feature-doc refresh both complete successfully for a merged PR
- **THEN** the system commits the resulting `openspec/`, `docs/changes/`, and `docs/features/` changes directly to the default branch and pushes them

#### Scenario: No commit when nothing changed
- **WHEN** the archive and doc-refresh steps produce no file changes (e.g. specs and docs were already current)
- **THEN** the system does not create an empty commit
