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
