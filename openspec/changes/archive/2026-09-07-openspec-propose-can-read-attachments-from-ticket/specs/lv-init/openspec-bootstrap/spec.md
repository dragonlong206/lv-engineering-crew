## ADDED Requirements

### Requirement: Propose workflow reads a change's downloaded attachments when writing the proposal
When the current change's `docs/changes/<change-id>/state.yaml` has a non-empty `attachments`, the system SHALL patch the installed `/opsx:propose` workflow file(s) so that, specifically when creating the `proposal` artifact, the workflow reads each listed attachment directly from the local repo path (no fetch needed — the file was already downloaded by `lv start`) and reflects what it observes in `proposal.md`'s "What Changes" and "Impact" sections. When an attachment's format cannot be read directly (e.g. a video), the workflow SHALL fall back to citing the file's name and path instead of claiming to have viewed its content. This instruction SHALL be scoped to the `/opsx:propose` workflow file(s) only, not the generic OpenSpec `context:` pointer that every workflow reads, since only the `proposal` artifact reflects this analysis.

#### Scenario: Attachments present, readable formats
- **WHEN** the engineer runs `/opsx:propose` on a change whose `state.yaml` lists one or more attachments that are images, PDFs, or text documents
- **THEN** the workflow's patched instructions direct it to read those files directly, specifically while creating the `proposal` artifact, and reflect their content in the proposal

#### Scenario: Attachment in an unreadable format
- **WHEN** the engineer runs `/opsx:propose` on a change whose `state.yaml` lists an attachment the workflow's tools cannot read directly (e.g. a video file)
- **THEN** the workflow falls back to citing that attachment's name and path in the proposal, rather than fabricating a description of its content

#### Scenario: No attachments
- **WHEN** the engineer runs `/opsx:propose` on a change whose `state.yaml` has no `attachments`
- **THEN** no attachment-specific instruction has any effect, and proposal creation behaves exactly as it did before this capability existed

#### Scenario: Other OpenSpec workflows are unaffected
- **WHEN** the engineer runs `/opsx:apply`, `/opsx:sync`, or `/opsx:archive` on a change whose `state.yaml` has non-empty `attachments`
- **THEN** that workflow's instructions carry no attachment-reading instruction, since only the `/opsx:propose` workflow file(s) are patched with it
