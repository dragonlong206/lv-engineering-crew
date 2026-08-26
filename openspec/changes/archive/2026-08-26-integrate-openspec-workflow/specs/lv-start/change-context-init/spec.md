## Purpose

Lets `lv start` create a change's `docs/changes/<change-id>/` context — from a Lark ticket ID or a free-text description — as the only artifact LV produces for that stage, so OpenSpec's own workflow picks up the context instead of LV generating an analysis document itself.

## ADDED Requirements

### Requirement: Starting from a ticket ID creates change context without generating an analysis document
The system SHALL fetch a ticket from Lark Base by ID, create `docs/changes/<ticket-id>/`, and write `state.yaml` capturing the ticket's title, description, and feature IDs, without generating or committing an analysis document.

#### Scenario: lv start from a ticket ID
- **WHEN** the engineer runs `lv start` with a ticket ID
- **THEN** the system fetches the ticket, creates `docs/changes/<ticket-id>/`, writes `state.yaml` with the ticket's title, description, and feature IDs, and does not write any analysis-document file

### Requirement: Starting from a free-text description creates change context without a Lark fetch
The system SHALL create `docs/changes/<change-id>/` and write a `state.yaml` of the same shape as the ticket-based mode, populated from a given free-text description, without contacting Lark Base.

#### Scenario: lv start from a free-text description
- **WHEN** the engineer runs `lv start` with a free-text description and no ticket ID
- **THEN** the system creates `docs/changes/<change-id>/` from that description, writes `state.yaml` capturing the description as context, and does not call the Lark Base API

### Requirement: Both entry modes still create a branch
The system SHALL create and check out a branch for the new change in either entry mode, following the repo's configured branch naming.

#### Scenario: Branch created regardless of entry mode
- **WHEN** the engineer starts a change from either a ticket ID or a free-text description
- **THEN** the system creates and checks out a branch named per the repo's configured branch-naming rules before finishing
