## Purpose

Lets `lv start` carry a ticket's attached files (documents, screenshots, or videos) from Lark Base into the started change's context, by downloading them into the change's `docs/changes/<change-id>/attachments/` directory and recording the downloaded paths in `state.yaml`, so they are available to the engineer and — via `lv init`'s OpenSpec context wiring (see the `lv-init/openspec-bootstrap` capability) — to OpenSpec workflows, instead of the attachment being left behind in Lark.

## ADDED Requirements

### Requirement: Attachment field is configurable and optional
The system SHALL provide a configuration setting naming the Lark Base column that holds a ticket's attachments. When the setting is unset, the system SHALL skip attachment capture entirely and behave exactly as it did before this capability existed.

#### Scenario: Field configured
- **WHEN** `lark.attachment_field` is set in configuration and `lv start <ticket-id>` fetches that ticket
- **THEN** the system reads the named column's value as the ticket's attachment field

#### Scenario: Field not configured
- **WHEN** `lark.attachment_field` is unset and `lv start <ticket-id>` fetches a ticket
- **THEN** the system does not attempt to read any attachment column, and no attachment is downloaded or persisted for that ticket

### Requirement: Ticket fetch extracts attachment metadata without downloading
`fetchTicket()` SHALL extract, from the configured attachment column, each attached file's identifying metadata (at minimum a file identifier usable to download it, and its original filename) into a flat list on the returned ticket. `fetchTicket()` SHALL NOT perform any network download of the file content itself — extraction stays a metadata-only read, consistent with how it handles every other ticket field.

#### Scenario: Attachment field with one or more files
- **WHEN** the configured column is a Lark attachment field holding one or more uploaded files
- **THEN** the extracted attachment list contains one entry per file, each carrying enough metadata to download that file later
- **AND** no file content is fetched during this extraction

#### Scenario: Empty or unset column on an otherwise valid ticket
- **WHEN** the configured column exists on the table but is empty for the fetched ticket
- **THEN** the extracted attachment list is empty, and no download or `state.yaml` entry results

### Requirement: lv start downloads extracted attachments into the change's docs directory
When `lv start` fetches a ticket with one or more extracted attachments, the system SHALL download each file's content and write it under `docs/changes/<change-id>/attachments/`, using the same Lark tenant token already obtained for the ticket fetch.

#### Scenario: Ticket has attachments
- **WHEN** `lv start <ticket-id>` fetches a ticket whose configured attachment column has one or more files
- **THEN** the system downloads each file's content and writes it into `docs/changes/<ticket-id>/attachments/`

#### Scenario: Ticket has no attachments
- **WHEN** `lv start <ticket-id>` fetches a ticket with no attachments, or the field is not configured
- **THEN** the system performs no download and creates no `attachments/` directory for that reason

### Requirement: A failed download is non-fatal
A failure to download one or more attachments SHALL be reported to the engineer but SHALL NOT stop `lv start` from completing its other work (branch creation, state persistence, Lark write-backs).

#### Scenario: One attachment fails to download
- **WHEN** `lv start` downloads a ticket's attachments and one file fails (e.g. an expired file reference or a network error)
- **THEN** the system prints a warning naming the failed file and continues starting the change, persisting whichever attachments did download successfully

### Requirement: Downloaded paths are persisted to the change's state
The system SHALL persist the repo-relative paths of every successfully downloaded attachment onto the started change's `docs/changes/<change-id>/state.yaml`, alongside its existing `title`, `description`, and `ui_design`. The system SHALL omit the field entirely when there are no successfully downloaded attachments.

#### Scenario: Ticket has attachments that download successfully
- **WHEN** `lv start <ticket-id>` downloads one or more attachments from a ticket
- **THEN** the written `state.yaml` includes the repo-relative path of each downloaded file

#### Scenario: Ticket has no attachments
- **WHEN** `lv start <ticket-id>` fetches a ticket with no attachments, or the field is not configured
- **THEN** the written `state.yaml` omits the attachments field entirely
