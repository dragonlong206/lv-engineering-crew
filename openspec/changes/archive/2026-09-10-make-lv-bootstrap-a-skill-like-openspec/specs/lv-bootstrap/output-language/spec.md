## MODIFIED Requirements

### Requirement: Bootstrap agents honor the configured output language
The system SHALL instruct the `lv-bootstrap` Claude Code skill/command — covering both explicit-paths input and autonomous codebase exploration — to write generated `overview.md`/`design.md` prose in the repo's configured output language, when one is set.

#### Scenario: Bootstrapping with an output language configured
- **WHEN** an engineer invokes the `lv-bootstrap` skill/command in a repo with an output language configured
- **THEN** the generated `overview.md` and `design.md` prose is written in that language

#### Scenario: Bootstrapping with no output language configured
- **WHEN** an engineer invokes the `lv-bootstrap` skill/command in a repo with no output language configured
- **THEN** the generated docs' language is unconstrained, matching current behavior

### Requirement: Bootstrap language instruction does not translate code facts
The instruction given to the `lv-bootstrap` skill/command SHALL scope the language constraint to descriptive prose, explicitly excluding code identifiers, file names, module names, and CLI flags/commands from translation.

#### Scenario: Bootstrapping a feature with an output language configured
- **WHEN** the `lv-bootstrap` skill/command generates `overview.md`/`design.md` content under an active output-language configuration
- **THEN** function/file/module names, CLI flags, and other code facts it cites remain untranslated, and only the surrounding descriptive prose is written in the configured language

### Requirement: Refining an existing draft preserves the configured output language
The system SHALL apply the configured output language when refining an existing draft `overview.md`/`design.md`, the same as when generating from scratch.

#### Scenario: Refining a draft written before the output language was configured
- **WHEN** an engineer invokes the `lv-bootstrap` skill/command with an output language configured, on a feature whose existing draft docs were written in a different language
- **THEN** the refined `overview.md`/`design.md` output is written in the configured output language
