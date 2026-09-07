## Purpose

Lets `lv init` install and configure OpenSpec for a chosen coding agent, wiring its generated skills/commands to automatically load LV's feature docs and the current change's context instead of the engineer pasting them into the prompt by hand.

## Requirements

### Requirement: lv init detects and offers to install a missing OpenSpec CLI
The system SHALL check whether the `openspec` executable is available before delegating to it, and, if it is not, SHALL prompt the engineer to confirm installing it globally via npm before continuing. This detection SHALL be reliable across platforms, including Windows, where a missing executable does not always surface the same error signal as it does on POSIX systems — the system SHALL NOT depend on a single platform-specific error signal to decide whether OpenSpec is installed. A check failure that isn't cleanly distinguishable from "not installed" (e.g. a PATH entry the process can't read) SHALL also be treated as "not installed" rather than crashing, and the install prompt SHALL say so ("not found or not installed properly") rather than asserting it's definitely absent.

#### Scenario: OpenSpec CLI already installed
- **WHEN** the engineer runs `lv init` and the `openspec` executable is already resolvable
- **THEN** the system proceeds directly to `openspec init` without prompting to install anything

#### Scenario: OpenSpec CLI missing, engineer confirms install
- **WHEN** the engineer runs `lv init`, the `openspec` executable is not resolvable, and the engineer confirms the install prompt
- **THEN** the system installs `@fission-ai/openspec` globally via npm and then proceeds to `openspec init`

#### Scenario: OpenSpec CLI missing, engineer declines install
- **WHEN** the engineer runs `lv init`, the `openspec` executable is not resolvable, and the engineer declines the install prompt
- **THEN** the system stops without running `openspec init` or modifying `openspec/config.yaml`, and prints how to install OpenSpec manually

#### Scenario: OpenSpec CLI missing on Windows
- **WHEN** the engineer runs `lv init` on Windows and the `openspec` executable is not resolvable
- **THEN** the system still recognizes it as not installed and offers the same install prompt as on other platforms, instead of crashing with an unhandled error

#### Scenario: Global install fails
- **WHEN** the engineer confirms the install prompt but the global npm install fails
- **THEN** the system reports the install failure and stops without running `openspec init`

#### Scenario: `openspec init` invocation itself fails
- **WHEN** `lv init` has detected OpenSpec is installed (or just installed it) and the subsequent `openspec init` invocation fails
- **THEN** the system reports the failure, including any diagnostic output captured from the failed invocation, and stops without patching `openspec/config.yaml`

### Requirement: lv init installs OpenSpec for a chosen coding agent
The system SHALL delegate installing/configuring OpenSpec to the OpenSpec CLI's own installer, supporting whatever set of coding agents the installed OpenSpec CLI advertises rather than a fixed list hardcoded in `lv`.

#### Scenario: Installing for a specific coding agent
- **WHEN** the engineer runs `lv init` for a given coding agent (e.g. Claude Code)
- **THEN** the system installs/configures OpenSpec for that agent by delegating to the OpenSpec CLI, without lv itself hardcoding a fixed list of supported agents

#### Scenario: Requesting an unsupported agent
- **WHEN** the engineer requests a coding agent the installed OpenSpec CLI does not recognize
- **THEN** the system surfaces the OpenSpec CLI's own error/tool list rather than silently succeeding or inventing support

### Requirement: Installed OpenSpec workflow loads LV feature docs automatically
The system SHALL augment the installed OpenSpec skill/command files (or another OpenSpec-provided context mechanism) so that OpenSpec's explore/propose/apply steps automatically read `docs/features/<feature-id>/{overview.md,design.md}` for any feature IDs relevant to the current change.

#### Scenario: Feature docs load without manual copy-paste
- **WHEN** the engineer runs an OpenSpec workflow inside a change that references feature ID `F0007`
- **THEN** the workflow's context includes `docs/features/F0007/overview.md` and `docs/features/F0007/design.md` without the engineer pasting their content into the request

### Requirement: Installed OpenSpec workflow loads the current change's ticket/description context
The system SHALL augment the installed OpenSpec skill/command files so OpenSpec's workflow reads the current change's `docs/changes/<change-id>/state.yaml` (ticket fields or free-text description) as context.

#### Scenario: Ticket context loads automatically
- **WHEN** the engineer runs an OpenSpec workflow on a change started from a Lark ticket
- **THEN** the workflow's context includes that ticket's title, description, and feature IDs as recorded in `docs/changes/<change-id>/state.yaml`, without the engineer re-typing them

#### Scenario: Description-only context loads automatically
- **WHEN** the engineer runs an OpenSpec workflow on a change started from a free-text description (no ticket)
- **THEN** the workflow's context includes that description as recorded in `docs/changes/<change-id>/state.yaml`, without the engineer re-typing it

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

### Requirement: Propose workflow analyzes a ticket's UI design reference when writing the proposal
When the current change's `docs/changes/<change-id>/state.yaml` has a non-empty `ui_design`, the system SHALL patch the installed `/opsx:propose` workflow file(s) so that, specifically when creating the `proposal` artifact, the workflow attempts to view or fetch the content each reference points to — preferring the Figma Dev Mode MCP Server's tools (e.g. `get_code`, `get_screenshot`, `get_variable_defs`) for a Figma URL when one is configured in the engineer's environment, and otherwise falling back to `WebFetch` (for a URL) or reading a local/downloadable image or PDF — and reflect what it observes in `proposal.md`'s "What Changes" and "Impact" sections, falling back further to citing the raw reference string when the asset can't be accessed by any available method. This instruction SHALL be scoped to the `/opsx:propose` workflow file(s) only, not the generic OpenSpec `context:` pointer that every workflow reads, since only the `proposal` artifact reflects this analysis.

#### Scenario: Figma reference with a Figma MCP server configured
- **WHEN** the engineer runs `/opsx:propose` on a change whose `ui_design` includes a Figma URL, and a Figma Dev Mode MCP Server is configured in their environment
- **THEN** the workflow's patched instructions direct it to prefer that MCP server's tools for that reference, specifically while creating the `proposal` artifact

#### Scenario: Figma reference with no Figma MCP server configured
- **WHEN** the engineer runs `/opsx:propose` on a change whose `ui_design` includes a Figma URL, and no Figma MCP server is configured
- **THEN** the workflow falls back to `WebFetch` for that reference, and further falls back to citing the raw URL if that yields nothing usable

#### Scenario: No UI design reference
- **WHEN** the engineer runs `/opsx:propose` on a change whose `state.yaml` has no `ui_design`
- **THEN** no UI-design-specific instruction has any effect, and proposal creation behaves exactly as it did before this capability existed

#### Scenario: Other OpenSpec workflows are unaffected
- **WHEN** the engineer runs `/opsx:apply`, `/opsx:sync`, or `/opsx:archive` on a change whose `state.yaml` has a non-empty `ui_design`
- **THEN** that workflow's instructions carry no UI-design-analysis instruction, since only the `/opsx:propose` workflow file(s) are patched with it

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
