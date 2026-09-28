# lv-init/spec-test-guidance Specification

## Purpose

Configures the OpenSpec workflow that `lv init` installs so the delta-spec scenarios in a change turn into automated tests. Task planning lists those tests explicitly, and apply implements and runs them using the repo's existing test conventions.

## Requirements

### Requirement: Apply workflow is configured to implement tests for change spec scenarios
The system SHALL configure the installed OpenSpec apply workflow so that its guidance tells the implementing agent to write automated tests covering the scenarios in the change's delta specs, and to run those tests before marking the related tasks complete. The guidance SHALL tell the agent to follow the target repo's existing test framework, test file locations, and naming conventions rather than choosing its own.

#### Scenario: Applying a change in a repo with an existing test suite
- **WHEN** an engineer runs the apply workflow on a change with delta spec scenarios, in a repo that already has an automated test suite
- **THEN** the apply workflow's guidance tells the agent to add or update tests in that suite covering those scenarios, and to run them before marking the related tasks complete

#### Scenario: Applying a change in a repo with no automated test suite
- **WHEN** an engineer runs the apply workflow on a change in a repo with no automated test framework
- **THEN** the apply workflow's guidance tells the agent not to introduce a new test framework unless the change's tasks call for one, and to report which delta spec scenarios remain without automated coverage

#### Scenario: Applying a change with no delta specs
- **WHEN** an engineer runs the apply workflow on a change with no delta spec scenarios (e.g. one that skips specs)
- **THEN** the test guidance asks for nothing spec-specific, and apply proceeds normally

### Requirement: Task planning is configured to include spec-derived test tasks
The system SHALL configure the installed OpenSpec workflow's rules for the tasks artifact so that generated task lists include explicit tasks for writing automated tests covering the change's delta spec scenarios. Each of those tasks SHALL identify the scenario or scenarios it covers.

#### Scenario: Generating tasks for a change with delta spec scenarios
- **WHEN** an engineer generates the tasks artifact for a change whose delta specs contain scenarios
- **THEN** the rules supplied for that artifact tell the agent to include test tasks that name the scenarios they cover

#### Scenario: Generating tasks in a repo with no automated test suite
- **WHEN** an engineer generates the tasks artifact in a repo with no automated test framework
- **THEN** the rules tell the agent to plan manual or scripted verification steps per scenario in place of new-framework test tasks

### Requirement: Test guidance is advisory, not blocking
The system SHALL NOT make any OpenSpec workflow fail or refuse to complete solely because the test guidance or the tasks rule was not followed.

#### Scenario: Apply completes without the recommended tests
- **WHEN** an engineer completes the apply workflow without writing the tests the guidance recommends
- **THEN** no LV-installed mechanism blocks or fails the workflow on that basis

### Requirement: Configuring the test guidance is idempotent and non-destructive
The system SHALL leave exactly one copy of the apply test guidance and exactly one copy of the tasks test rule in the OpenSpec configuration, however many times the configuring step runs. The system SHALL keep any existing guidance for other operations, including the archive feature-doc-refresh guidance, and any apply guidance or artifact rules the engineer has written themselves.

#### Scenario: Configuring step runs more than once
- **WHEN** the configuring step runs again on a project that already has the test guidance and tasks rule
- **THEN** the OpenSpec configuration still contains exactly one copy of each

#### Scenario: Engineer already has custom apply guidance or tasks rules
- **WHEN** the configuring step runs on a project whose OpenSpec configuration already holds engineer-written apply guidance or tasks rules
- **THEN** those entries are kept, and the LV test guidance and rule are added next to them

#### Scenario: Archive guidance is already configured
- **WHEN** the configuring step runs on a project that already has LV's archive feature-doc-refresh guidance
- **THEN** that archive guidance is left unchanged, and the apply test guidance is added under the apply operation
