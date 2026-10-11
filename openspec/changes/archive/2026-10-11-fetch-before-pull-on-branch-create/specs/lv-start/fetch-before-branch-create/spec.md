## Purpose

Ensures a branch created by `lv start` forks from the latest remote state of its base branch rather than a stale local copy.

## ADDED Requirements

### Requirement: Fetch latest commits before updating the base branch
When creating a new change branch, the system SHALL fetch the latest commits from the remote before checking out and fast-forwarding the base branch, and SHALL then create the new branch from the updated base branch.

#### Scenario: Remote has newer commits on the base branch
- **WHEN** the remote base branch has commits the local base branch lacks and the engineer runs `lv start`
- **THEN** the new branch is created from a base branch that includes those commits

#### Scenario: Base branch exists only on the remote
- **WHEN** the configured base branch has no local branch but exists on the remote
- **THEN** the system fetches it and creates the new branch from it

### Requirement: Fetch failure does not block branch creation
The system SHALL continue creating the branch from the local base branch when the fetch fails (for example no remote or no network).

#### Scenario: Fetch fails
- **WHEN** the fetch from the remote fails
- **THEN** `lv start` still creates the branch from the local base branch without aborting
