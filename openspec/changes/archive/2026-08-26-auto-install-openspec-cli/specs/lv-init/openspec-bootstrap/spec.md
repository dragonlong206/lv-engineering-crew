## ADDED Requirements

### Requirement: lv init detects and offers to install a missing OpenSpec CLI
The system SHALL check whether the `openspec` executable is available before delegating to it, and, if it is not, SHALL prompt the engineer to confirm installing it globally via npm before continuing.

#### Scenario: OpenSpec CLI already installed
- **WHEN** the engineer runs `lv init` and the `openspec` executable is already resolvable
- **THEN** the system proceeds directly to `openspec init` without prompting to install anything

#### Scenario: OpenSpec CLI missing, engineer confirms install
- **WHEN** the engineer runs `lv init`, the `openspec` executable is not resolvable, and the engineer confirms the install prompt
- **THEN** the system installs `@fission-ai/openspec` globally via npm and then proceeds to `openspec init`

#### Scenario: OpenSpec CLI missing, engineer declines install
- **WHEN** the engineer runs `lv init`, the `openspec` executable is not resolvable, and the engineer declines the install prompt
- **THEN** the system stops without running `openspec init` or modifying `openspec/config.yaml`, and prints how to install OpenSpec manually

#### Scenario: Global install fails
- **WHEN** the engineer confirms the install prompt but the global npm install fails
- **THEN** the system reports the install failure and stops without running `openspec init`
