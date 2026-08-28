## Purpose

Lets LV record which OpenSpec change(s) belong to the current branch's change, since OpenSpec change names are not derivable from the LV change ID by convention and one LV change can spawn more than one OpenSpec change.

## Requirements

### Requirement: `lv link` records an OpenSpec change name against the current change
The system SHALL, given an OpenSpec change name, resolve the current change from the current git branch and append that name to the change's `state.yaml` `openspec_changes` list, creating the field if absent.

#### Scenario: Linking a new OpenSpec change
- **WHEN** the engineer runs `lv link <name>` on a recognized change branch and `<name>` is not already in that change's `state.yaml` `openspec_changes` list
- **THEN** the system appends `<name>` to `openspec_changes` and persists `state.yaml`

#### Scenario: Linking the same name twice is idempotent
- **WHEN** the engineer runs `lv link <name>` and `<name>` is already present in `openspec_changes`
- **THEN** the system leaves `state.yaml` unchanged and does not add a duplicate entry

#### Scenario: Not on a recognized change branch
- **WHEN** the engineer runs `lv link <name>` while the current branch does not resolve to a change (same resolution `lv status` uses)
- **THEN** the system reports an error and exits non-zero without writing any file

### Requirement: `/opsx:propose` records the OpenSpec change it creates
The system's `/opsx:propose` workflow SHALL run `lv link "<name>"` immediately after successfully creating a new OpenSpec change named `<name>`, so the association is recorded without a separate manual step.

#### Scenario: Proposing from a change branch with a matching state.yaml
- **WHEN** `/opsx:propose` creates a new OpenSpec change while on a branch with a matching `docs/changes/<change-id>/state.yaml`
- **THEN** the workflow runs `lv link` with the created change's name, recording it in that `state.yaml`

#### Scenario: Proposing with no matching state.yaml
- **WHEN** `/opsx:propose` creates a new OpenSpec change while there is no `docs/changes/<change-id>/state.yaml` matching the current branch
- **THEN** the workflow does not run `lv link` and proceeds without recording an association
