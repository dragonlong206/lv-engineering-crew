## ADDED Requirements

### Requirement: Propose workflow falls back to state title when description is empty
When `lv init` patches the installed `/opsx:propose` workflow file(s) with LV's state-autoload instruction, that instruction SHALL treat a matching `docs/changes/<change-id>/state.yaml` as usable when it has a non-empty `title` even if `description` is empty. In that case, the workflow SHALL derive the kebab-case change name from `title` and SHALL use `title` as the change description fallback instead of asking the engineer to restate the change. When `description` is non-empty, the workflow SHALL continue to prefer `description` as the change description.

#### Scenario: Empty description falls back to title
- **WHEN** the engineer runs `/opsx:propose` on a branch whose matching `docs/changes/<change-id>/state.yaml` has a non-empty `title` and an empty `description`
- **THEN** the workflow derives the change name from `title`, uses `title` as the change description for the proposal flow, and does not ask the engineer to describe the change again

#### Scenario: Non-empty description remains preferred
- **WHEN** the engineer runs `/opsx:propose` on a branch whose matching `docs/changes/<change-id>/state.yaml` has both a non-empty `title` and a non-empty `description`
- **THEN** the workflow derives the change name from `title` and uses `description` as the change description, preserving the current preferred source order

#### Scenario: No usable state context still asks the engineer
- **WHEN** the engineer runs `/opsx:propose` and there is no matching `state.yaml`, or the matching file has no usable `title` and no usable `description`
- **THEN** the workflow asks the engineer to describe the change instead of inventing missing context
