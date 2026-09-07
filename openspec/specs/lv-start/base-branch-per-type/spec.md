## Purpose

Lets a repo following a gitflow-style branching model configure a different base branch per `lv start` branch type (e.g. `hotfix` from `master`, `feature` from `develop`), instead of every branch type forking from the same `default_branch`.

## Requirements

### Requirement: A branch type may configure its own base branch
The system SHALL allow each entry in `branch_types` to specify, in addition to its naming pattern, a base branch that branches of that type are created from. A type with no base branch configured SHALL fall back to `default_branch`.

#### Scenario: Type with a configured base branch
- **WHEN** `branch_types` configures a `base_branch` for the type being started
- **THEN** the system creates the new branch from that configured base branch

#### Scenario: Type with no configured base branch
- **WHEN** `branch_types` configures a type with no `base_branch` (or `branch_types` uses the plain-string pattern shorthand for that type)
- **THEN** the system creates the new branch from `default_branch`

### Requirement: Plain string branch_types entries remain valid
The system SHALL continue to accept a `branch_types` entry written as a plain pattern string (with no base branch), treating it identically to a type with no `base_branch` configured.

#### Scenario: Existing plain-string configuration
- **WHEN** `.lv.yaml` configures `branch_types` as a map of type name to plain pattern string, as it did before this capability existed
- **THEN** `lv start` renders branch names exactly as before and creates every branch from `default_branch`

### Requirement: The resolved base branch is used for both branch creation and restart
The system SHALL resolve the base branch for the branch type being started (`--type`, or `default_branch_type` when `--type` is omitted) and use that resolved base branch both when creating a new branch and when discarding and recreating a branch on restart of an existing change branch.

#### Scenario: Restarting a change whose type has a configured base branch
- **WHEN** the engineer restarts an existing change branch whose type has a configured `base_branch`
- **THEN** the system discards the existing branch and recreates it from that type's configured base branch, not from `default_branch`
