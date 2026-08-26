## Purpose

Lets `lv init` install and configure OpenSpec for a chosen coding agent, wiring its generated skills/commands to automatically load LV's feature docs and the current change's context instead of the engineer pasting them into the prompt by hand.

## Requirements

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
