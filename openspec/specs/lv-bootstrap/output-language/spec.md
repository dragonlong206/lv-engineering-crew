# output-language Specification

## Purpose

Makes `lv bootstrap`'s own LLM calls — which generate `overview.md`/`design.md` content directly, outside any OpenSpec workflow — honor the same repo-configured output language as OpenSpec-driven generation, so the "all LLMs" guarantee holds regardless of which code path produced the text.

## Requirements

### Requirement: Bootstrap agents honor the configured output language
The system SHALL instruct `lv bootstrap`'s generation agents (both the single-shot path used with `--paths`, and the autonomous codebase-exploration path used without it) to write generated `overview.md`/`design.md` prose in the repo's configured output language, when one is set.

#### Scenario: Bootstrapping with an output language configured
- **WHEN** an engineer runs `lv bootstrap <feature-id>` in a repo with an output language configured
- **THEN** the generated `overview.md` and `design.md` prose is written in that language

#### Scenario: Bootstrapping with no output language configured
- **WHEN** an engineer runs `lv bootstrap <feature-id>` in a repo with no output language configured
- **THEN** the generated docs' language is unconstrained, matching current behavior

### Requirement: Bootstrap language instruction does not translate code facts
The instruction given to bootstrap agents SHALL scope the language constraint to descriptive prose, explicitly excluding code identifiers, file names, module names, and CLI flags/commands from translation.

#### Scenario: Bootstrapping a feature with an output language configured
- **WHEN** a bootstrap agent generates `overview.md`/`design.md` content under an active output-language configuration
- **THEN** function/file/module names, CLI flags, and other code facts it cites remain untranslated, and only the surrounding descriptive prose is written in the configured language

### Requirement: Refining an existing draft preserves the configured output language
The system SHALL apply the configured output language when refining an existing draft `overview.md`/`design.md`, the same as when generating from scratch.

#### Scenario: Refining a draft written before the output language was configured
- **WHEN** an engineer runs `lv bootstrap <feature-id>` with an output language configured, on a feature whose existing draft docs were written in a different language
- **THEN** the refined `overview.md`/`design.md` output is written in the configured output language
