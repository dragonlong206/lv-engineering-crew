## MODIFIED Requirements

### Requirement: lv init detects and offers to install a missing OpenSpec CLI
The system SHALL check whether the `openspec` executable is available before delegating to it, and, if it is not, SHALL prompt the engineer to confirm installing it globally via npm before continuing. This detection SHALL be reliable across platforms, including Windows, where a missing executable does not always surface the same error signal as it does on POSIX systems — the system SHALL NOT depend on a single platform-specific error signal to decide whether OpenSpec is installed. A check failure that isn't cleanly distinguishable from "not installed" (e.g. a PATH entry the process can't read) SHALL also be treated as "not installed" rather than crashing, and the install prompt SHALL say so ("not found or not installed properly") rather than asserting it's definitely absent.

#### Scenario: OpenSpec CLI already installed
- **WHEN** the engineer runs `lv init` and the `openspec` executable is already resolvable
- **THEN** the system proceeds directly to `openspec init` without prompting to install anything

#### Scenario: OpenSpec CLI missing, engineer confirms install
- **WHEN** the engineer runs `lv init`, the `openspec` executable is not resolvable, and the engineer confirms the install prompt
- **THEN** the system installs `@fission-ai/openspec` globally via npm and then proceeds to `openspec init`

#### Scenario: OpenSpec CLI missing, engineer declines install
- **WHEN** the engineer runs `lv init`, the `openspec` executable is not resolvable, and the engineer declines the install prompt
- **THEN** the system stops without running `openspec init` or modifying `openspec/config.yaml`, and prints how to install OpenSpec manually

#### Scenario: OpenSpec CLI missing on Windows
- **WHEN** the engineer runs `lv init` on Windows and the `openspec` executable is not resolvable
- **THEN** the system still recognizes it as not installed and offers the same install prompt as on other platforms, instead of crashing with an unhandled error

#### Scenario: Global install fails
- **WHEN** the engineer confirms the install prompt but the global npm install fails
- **THEN** the system reports the install failure and stops without running `openspec init`

#### Scenario: `openspec init` invocation itself fails
- **WHEN** `lv init` has detected OpenSpec is installed (or just installed it) and the subsequent `openspec init` invocation fails
- **THEN** the system reports the failure, including any diagnostic output captured from the failed invocation, and stops without patching `openspec/config.yaml`
