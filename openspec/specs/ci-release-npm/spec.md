# ci-release-npm Specification

## Purpose
Automatically publishes `lv-engineer-crew` to the public npm registry when a maintainer publishes a GitHub Release, replacing the manual `npm publish` step with a verified, auditable CI run.

## Requirements

### Requirement: Publishing is triggered by a published GitHub Release

The npm publish pipeline SHALL run only in response to a GitHub Release being published, not on every push or merge to the default branch.

#### Scenario: A maintainer publishes a GitHub Release

- **WHEN** a maintainer publishes a GitHub Release (whether created directly as published, or promoted from a draft/pre-release)
- **THEN** the publish pipeline starts, checking out the exact commit/tag the release points at

#### Scenario: A commit merges to the default branch without a release

- **WHEN** a pull request merges into the default branch and no GitHub Release is published as a result
- **THEN** the publish pipeline does not run and no npm publish is attempted

### Requirement: Release tag version must match package version before publishing

The pipeline SHALL verify that the released tag's version identifier matches the `version` field in `package.json` at the released commit, and SHALL fail without publishing when they differ.

#### Scenario: Release tag matches package.json version

- **WHEN** a GitHub Release is published for tag `v1.2.3` and `package.json` at that commit has `"version": "1.2.3"`
- **THEN** the pipeline proceeds to build and publish

#### Scenario: Release tag does not match package.json version

- **WHEN** a GitHub Release is published for tag `v1.3.0` but `package.json` at that commit has `"version": "1.2.3"`
- **THEN** the pipeline fails before running `npm publish`, and no package is published to the registry

### Requirement: A fresh, verified build precedes publishing

The pipeline SHALL run this project's standard verification (type-checking) and a full build of the package's distributable output before publishing, so an unverified or stale build is never published.

#### Scenario: Type errors present at the released commit

- **WHEN** the released commit fails type-checking
- **THEN** the pipeline fails before `npm publish` runs, and no package is published to the registry

#### Scenario: Verification passes

- **WHEN** the released commit passes type-checking and the build succeeds
- **THEN** the pipeline proceeds to publish the freshly built output, independent of any build artifacts left over from a previous run

### Requirement: Successful publish makes the release version installable from npm

When the pipeline completes successfully, the released version SHALL be available for installation from the public npm registry under the package's published name.

#### Scenario: Installing after a successful release

- **WHEN** the publish pipeline for release `v1.2.3` completes successfully
- **THEN** running `npm install -g lv-engineer-crew@1.2.3` (or `npm view lv-engineer-crew version`) reflects version `1.2.3` as available on the registry

### Requirement: Publishing requires a configured trust relationship with the registry and fails visibly if absent

The pipeline SHALL authenticate to the npm registry using a trust relationship provisioned outside the workflow's own code (registry-side configuration identifying this exact repository and workflow as an authorized publisher, not a stored long-lived secret), and SHALL fail with a visible error — not silently skip — when that trust relationship is missing or the registry rejects the resulting authentication.

#### Scenario: Trust relationship is configured

- **WHEN** the publish pipeline runs and the registry has this repository/workflow registered as an authorized publisher for the package
- **THEN** `npm publish` authenticates successfully and the package is published

#### Scenario: Trust relationship is missing or misconfigured

- **WHEN** the publish pipeline runs and the registry has no matching authorized-publisher configuration for this repository/workflow
- **THEN** the `npm publish` step fails with an authentication error, the pipeline run is marked failed, and no package is published
