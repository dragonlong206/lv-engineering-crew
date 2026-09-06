## Purpose

Lets an engineer pin the language that every OpenSpec-driven workflow (propose/apply/sync/archive) writes generated artifact prose in, by configuring it once in `.lv.yaml` and having `lv init` wire that setting into the OpenSpec context every workflow already reads.

## ADDED Requirements

### Requirement: Output language is configurable per repo
The system SHALL accept an optional output-language setting in the repo's LV configuration. When unset, the system SHALL NOT constrain the language of any generated content.

#### Scenario: Output language configured
- **WHEN** an engineer sets an output language (e.g. "Vietnamese") in the repo's LV configuration
- **THEN** the system treats that value as the configured output language for the repo

#### Scenario: Output language left unset
- **WHEN** the repo's LV configuration does not set an output language
- **THEN** the system applies no language constraint, matching current behavior

### Requirement: OpenSpec workflows are instructed to honor the configured output language
The system SHALL configure the installed OpenSpec workflow so that its project-wide context instructs checking the repo's LV configuration for an output language and, when set, writing generated artifact prose in that language.

#### Scenario: Engineer runs any OpenSpec workflow with an output language configured
- **WHEN** an engineer runs `/opsx:propose`, `/opsx:apply`, `/opsx:sync`, or `/opsx:archive` in a repo with an output language configured
- **THEN** the project-wide context available to that workflow instructs writing generated artifact prose in the configured language

#### Scenario: Engineer runs an OpenSpec workflow with no output language configured
- **WHEN** an engineer runs any OpenSpec workflow in a repo with no output language configured
- **THEN** the project-wide context available to that workflow carries no language instruction, and workflows behave as before this change

### Requirement: Language instruction does not translate identifiers, code, or paths
The instruction the system configures SHALL scope the language constraint to prose content, explicitly excluding code, identifiers, file paths, and command names from translation.

#### Scenario: Generating an artifact with an output language configured
- **WHEN** a workflow generates an artifact under an active output-language configuration
- **THEN** the instruction available to it states that code blocks, identifiers, file paths, and command names are left as-is, and only body prose is written in the configured language

### Requirement: Wiring the output-language instruction is idempotent
The system SHALL result in exactly one copy of the output-language instruction in the OpenSpec configuration no matter how many times the configuring step runs.

#### Scenario: Configuring step runs more than once
- **WHEN** the step that wires the output-language instruction runs again on a project already configured with it
- **THEN** the OpenSpec configuration ends up with exactly one copy of the instruction, not a duplicate

#### Scenario: Configured output language changes after wiring
- **WHEN** an engineer changes the configured output language after `lv init` has already wired the instruction
- **THEN** the existing instruction still applies without needing to re-run the configuring step, because it references the configuration setting rather than embedding its value
