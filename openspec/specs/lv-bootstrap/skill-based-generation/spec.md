# skill-based-generation Specification

## Purpose

Lets an engineer generate or refine a feature's `overview.md`/`design.md` by running an `lv-bootstrap` skill in whichever coding agent they use — any agent OpenSpec is installed for, not a fixed list — that explores the repo (or reads given paths) and writes the docs directly, instead of `lv` driving a separate LLM agent through its own API calls.

## Requirements

### Requirement: Skill explores the codebase autonomously when no paths are given
The system SHALL provide an `lv-bootstrap` skill (and, for tools that support one, a matching slash command) that, when invoked for a feature ID with no explicit paths, explores the repository using the calling coding agent's own file-reading and search tools and writes `docs/features/<feature-id>/overview.md` and `design.md` grounded in what it finds — without `lv` itself making any LLM API call to perform the exploration or drafting.

#### Scenario: Engineer invokes the skill with no explicit paths
- **WHEN** an engineer invokes the `lv-bootstrap` skill/command for a feature ID, without pointing it at specific files or directories
- **THEN** the calling coding agent explores the repository itself and writes `overview.md` and `design.md` for that feature ID, grounded in the code it read

#### Scenario: No separate agent call is made
- **WHEN** the `lv-bootstrap` skill/command runs in either mode described by this capability, in any supported coding agent
- **THEN** `lv` does not invoke a separate LLM agent or make its own model API call to perform the exploration or drafting — the work happens entirely within the calling coding agent's own turn

### Requirement: Skill generates from explicitly given paths
The system SHALL let the skill/command be invoked with one or more explicit file or directory paths, in which case the calling coding agent reads only those paths (recursing into any given directory) and writes `overview.md`/`design.md` from that content, without also performing autonomous repository exploration.

#### Scenario: Engineer invokes the skill with explicit paths
- **WHEN** an engineer invokes the `lv-bootstrap` skill/command for a feature ID with one or more explicit file/directory paths
- **THEN** the calling coding agent reads only the given paths and writes `overview.md`/`design.md` from their content, without exploring the rest of the repository

### Requirement: Skill refines an existing draft rather than overwriting it blindly
The system SHALL, when `docs/features/<feature-id>/overview.md` or `design.md` already exists, instruct the skill to treat that content as a draft to verify and refine — reusing claims it confirms are still accurate and rewriting any claim about the code (function signatures, CLI flags, file/module names, architecture) purely from what it observes in this run — rather than copying the draft forward unexamined or discarding it outright.

#### Scenario: Existing draft docs are present
- **WHEN** the skill/command runs for a feature ID that already has an `overview.md` and/or `design.md`
- **THEN** the resulting docs keep only the draft's claims the agent verified are still true, and any code-fact claim is rewritten from this run's own exploration

### Requirement: Generated docs carry the auto-generated header and update the feature index
The system SHALL instruct the skill to prepend the standard auto-generated header to both written files and to update `docs/features/INDEX.md` for the feature ID, matching the header and index-update conventions used by every other docs-generation mode.

#### Scenario: Skill writes docs for a feature with no index entry yet
- **WHEN** the skill/command writes `overview.md`/`design.md` for a feature ID with no existing link in `docs/features/INDEX.md`
- **THEN** both files start with the standard auto-generated header, and `docs/features/INDEX.md` gains a link for that feature ID

### Requirement: Skill behavior is identical across every coding agent it is installed for
The system SHALL give the `lv-bootstrap` skill the same exploration, refinement, header, and index-update behavior described by this capability regardless of which coding agent is running it — only the installed file locations and, where a command wrapper exists for that agent, the command wrapper differ per agent, not the generation behavior itself.

#### Scenario: Same feature bootstrapped from two different coding agents
- **WHEN** the `lv-bootstrap` skill is invoked for the same feature ID from two different coding agents it is installed for
- **THEN** both runs follow the same exploration/refinement rules and produce docs in the same format, differing only in whatever content is naturally specific to that run's own exploration
