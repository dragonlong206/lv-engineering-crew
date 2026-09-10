## Purpose

Lets `lv init` install the `lv-bootstrap` skill (and, where a known command shape exists, its slash command) into every coding agent OpenSpec was just installed for, the same way it already installs and wires OpenSpec's own skill/command files, so an engineer doesn't have to add them by hand — and without `lv` maintaining a fixed list of which coding agents this applies to.

## ADDED Requirements

### Requirement: lv init installs the lv-bootstrap skill for every coding agent OpenSpec installed a skill for
The system SHALL detect which coding agents were installed by this `lv init` run by finding every OpenSpec-generated skill directory in the repo, without relying on a fixed list of coding agent names, and SHALL write the `lv-bootstrap` skill file into each one's own directory, so the engineer can invoke feature-doc generation directly from any of them without extra setup. This mirrors OpenSpec's own tool support, which the `openspec` CLI determines dynamically rather than from a list `lv` maintains.

#### Scenario: Initializing a repo for one coding agent
- **WHEN** an engineer runs `lv init` with one coding agent selected
- **THEN** the system writes the `lv-bootstrap` skill file into that agent's own directory, in addition to installing OpenSpec for it

#### Scenario: Initializing a repo for multiple coding agents at once
- **WHEN** an engineer runs `lv init` selecting more than one coding agent in the same run
- **THEN** the system writes the `lv-bootstrap` skill file into every selected agent's own directory

#### Scenario: Initializing a repo for a coding agent lv has never been updated to name
- **WHEN** an engineer runs `lv init` for a coding agent that OpenSpec supports but that no `lv` code has ever referenced by name
- **THEN** the system still writes the `lv-bootstrap` skill file into that agent's own directory, because detection is based on what OpenSpec actually installed, not on a list of agent names `lv` recognizes

### Requirement: A slash command is installed only for coding agents whose command format lv knows
The system SHALL additionally write an `lv-bootstrap` slash command file for a coding agent only when `lv` has a command template for that agent's specific format, and SHALL leave every other agent with the skill only.

#### Scenario: Coding agent with a known command format
- **WHEN** an engineer runs `lv init` for a coding agent `lv` has a command template for (Claude Code or Cursor)
- **THEN** the system writes both the `lv-bootstrap` skill file and a matching slash command file for that agent, in that agent's own command-file format

#### Scenario: Coding agent without a known command format
- **WHEN** an engineer runs `lv init` for a coding agent `lv` has no command template for
- **THEN** the system writes only the `lv-bootstrap` skill file for that agent, and the engineer invokes it as a skill rather than through a dedicated slash command

### Requirement: Installing the skill and command is idempotent per agent
The system SHALL result in exactly one copy of the `lv-bootstrap` skill file, and (for an agent with a known command format) exactly one copy of its command file, per coding agent, no matter how many times `lv init` runs for that agent against the same repo.

#### Scenario: lv init runs more than once for the same agent
- **WHEN** an engineer runs `lv init` for the same coding agent again on a repo that already has that agent's `lv-bootstrap` skill (and command file, if applicable) installed
- **THEN** the repo ends up with exactly one skill file, and at most one command file, for that agent, reflecting the current content, not a duplicate

### Requirement: Skill content is identical across every coding agent
The system SHALL write the same `lv-bootstrap` skill body content for every coding agent it installs the skill for, varying only the file location and frontmatter fields each agent's own skill format requires — so generation behavior does not depend on which agent installed it.

#### Scenario: Comparing the installed skill across two agents
- **WHEN** an engineer inspects the installed `lv-bootstrap` skill file for two different coding agents in the same repo
- **THEN** their instructional body content is the same, and only the file path and frontmatter fields differ
