## ADDED Requirements

### Requirement: Propose workflow uses a sub-task's parent context as background when writing the proposal
When the current change's `docs/changes/<change-id>/state.yaml` has a `parent` block, the system SHALL patch the installed `/opsx:propose` workflow file(s) so that, when creating the `proposal` artifact, the workflow reads the parent's title and description as background context. The workflow SHALL keep the change's own `title`/`description` as its scope, and SHALL NOT propose the parent's remaining work as part of this change. This instruction SHALL be scoped to the `/opsx:propose` workflow file(s) only, not the generic OpenSpec `context:` pointer, and SHALL be applied idempotently, like the other `/opsx:propose` patches.

#### Scenario: Sub-task with a parent block
- **WHEN** the engineer runs `/opsx:propose` on a change whose `state.yaml` has a `parent` block
- **THEN** the workflow's patched instructions direct it to use the parent's description as background when writing `proposal.md`, while scoping the proposal to the sub-task's own title and description

#### Scenario: No parent block
- **WHEN** the engineer runs `/opsx:propose` on a change whose `state.yaml` has no `parent` block
- **THEN** the parent-context instruction has no effect, and proposal creation behaves exactly as it did before this capability existed

#### Scenario: Re-running lv init does not duplicate the patch
- **WHEN** the engineer runs `lv init` on a repo whose `/opsx:propose` workflow file(s) already contain the parent-context instruction
- **THEN** the instruction is not inserted a second time
