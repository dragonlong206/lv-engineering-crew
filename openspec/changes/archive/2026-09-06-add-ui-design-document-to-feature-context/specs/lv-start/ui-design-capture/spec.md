## Purpose

Lets `lv start` carry a ticket's UI design reference (a Figma link, an HTML prototype, or an attached image/PDF) from Lark Base into the change context and the referenced feature's docs, so the reference is available to the engineer and — via `lv init`'s OpenSpec context wiring (see the `lv-init/openspec-bootstrap` capability) — to OpenSpec workflows, instead of the design being dropped during ticket ingestion or only cited as a bare link.

## ADDED Requirements

### Requirement: UI design field is configurable and optional
The system SHALL provide a configuration setting naming the Lark Base column that holds a ticket's UI design reference. When the setting is unset, the system SHALL skip UI design capture entirely and behave exactly as it did before this capability existed.

#### Scenario: Field configured
- **WHEN** `lark.ui_design_field` is set in configuration and `lv start <ticket-id>` fetches that ticket
- **THEN** the system reads the named column's value as the ticket's UI design reference

#### Scenario: Field not configured
- **WHEN** `lark.ui_design_field` is unset and `lv start <ticket-id>` fetches a ticket
- **THEN** the system does not attempt to read any UI design column, and no `ui_design` value is produced for that ticket

### Requirement: Reference extraction normalizes any field shape to a flat list
The system SHALL normalize the configured column's value — whether a plain text/URL field, a Lark attachment field (one or more files), or a Lark URL-type field — into a flat list of reference strings, discarding entries that resolve to nothing usable.

#### Scenario: Plain text or URL field
- **WHEN** the configured column is a plain text field containing a Figma URL
- **THEN** the extracted UI design references contain that URL as a single entry

#### Scenario: Attachment field with multiple files
- **WHEN** the configured column is a Lark attachment field holding an HTML prototype file and a PDF file
- **THEN** the extracted UI design references contain one entry per attached file, each resolving to a URL or filename usable to locate that file

#### Scenario: Empty or unset column on an otherwise valid ticket
- **WHEN** the configured column exists on the table but is empty for the fetched ticket
- **THEN** the extracted UI design references are an empty list, and no `ui_design` value is persisted for that ticket

### Requirement: Ticket capture stores the reference only
`lv`'s ticket-fetch and state-persistence code (`fetchTicket()`, `lv start`) SHALL persist only the reference (URL, filename, or link) to a UI design asset. This code SHALL NOT download, render, or otherwise analyze the content the reference points to — content analysis, when it happens, is performed downstream by an OpenSpec workflow via `lv init`'s context wiring (see the `lv-init/openspec-bootstrap` capability), never by `lv` itself.

#### Scenario: Reference-only capture
- **WHEN** a ticket's UI design field resolves to one or more references
- **THEN** `lv start` records those references as-is and performs no network fetch, download, or content analysis of what they point to

### Requirement: Non-empty references are persisted to the change's state
The system SHALL persist a non-empty list of UI design references onto the started change's `docs/changes/<change-id>/state.yaml`, alongside its existing `title` and `description`. The system SHALL omit the field entirely when there are no references to persist.

#### Scenario: Ticket has a UI design reference
- **WHEN** `lv start <ticket-id>` fetches a ticket with one or more UI design references
- **THEN** the written `state.yaml` includes those references

#### Scenario: Ticket has no UI design reference
- **WHEN** `lv start <ticket-id>` fetches a ticket with no UI design references, or the field is not configured
- **THEN** the written `state.yaml` omits the UI design field entirely

### Requirement: References reach inline-bootstrapped feature docs
When `lv start` generates feature docs inline for a referenced feature that has no existing `docs/features/<id>/` directory, the system SHALL include the ticket's UI design references, when present, as context for that generation so they are recorded as part of the feature's persistent documentation, not only the current change's state.

#### Scenario: New feature referenced by a ticket with a UI design reference
- **WHEN** `lv start` bootstraps feature docs inline for a feature ID that a ticket with a UI design reference introduces
- **THEN** the generated feature docs are produced with the UI design reference available as input context
