## Purpose

Lets an engineer pin the `/opsx:apply` workflow to a cheaper Claude Code model by configuring it once in `.lv.yaml`, with `lv init` wiring that pin into the generated apply command's frontmatter so every future apply run actually executes on it.

## ADDED Requirements

### Requirement: Apply model is configurable per repo
The system SHALL accept an optional apply-model setting in the repo's LV configuration, holding a Claude Code model alias or id. When unset, the system SHALL NOT constrain which model executes the apply workflow.

#### Scenario: Apply model configured
- **WHEN** an engineer sets an apply-model value (e.g. `"haiku"`) in the repo's LV configuration
- **THEN** the system treats that value as the configured apply model for the repo

#### Scenario: Apply model left unset
- **WHEN** the repo's LV configuration does not set an apply model
- **THEN** the system applies no model constraint to the apply workflow, matching current behavior

### Requirement: The generated Claude Code apply command is pinned to the configured model
When the repo's LV configuration has a non-empty apply-model setting and a generated Claude Code apply command file exists, the system SHALL set that file's `model` frontmatter field to the configured value.

#### Scenario: Apply model configured before installing OpenSpec support
- **WHEN** an engineer runs the configuring step with an apply model configured and a generated Claude Code apply command file present
- **THEN** that file's frontmatter carries a `model` field equal to the configured value

#### Scenario: Apply model changed after the command file was already pinned
- **WHEN** an engineer changes the configured apply model and re-runs the configuring step
- **THEN** the generated Claude Code apply command file's `model` field is updated to the new value, with no duplicate `model` field left behind

### Requirement: Only the known Claude Code apply command shape is patched
The system SHALL limit this frontmatter patch to the generated file location(s) known to support a per-command model override, and SHALL NOT modify apply-related files belonging to a coding-agent shape it has no such template for.

#### Scenario: Repo has no generated Claude Code apply command file
- **WHEN** the configuring step runs in a repo where no generated Claude Code apply command file exists (e.g. only a different coding agent was installed)
- **THEN** the system makes no apply-model-related change to any file

### Requirement: Clearing the setting removes a previously-applied pin
The system SHALL remove a `model` field it previously added to the generated Claude Code apply command file when the apply-model setting is absent at the time the configuring step runs.

#### Scenario: Apply model setting removed from configuration
- **WHEN** an engineer removes the apply-model setting from the repo's LV configuration after the configuring step had already pinned the generated apply command file, and re-runs the configuring step
- **THEN** the generated Claude Code apply command file's frontmatter no longer carries a `model` field

### Requirement: Wiring the apply-model pin is idempotent
The system SHALL result in exactly one `model` frontmatter field in the generated Claude Code apply command file no matter how many times the configuring step runs with the same apply-model setting.

#### Scenario: Configuring step runs more than once with the same setting
- **WHEN** the configuring step runs again on a project already pinned to the same apply-model value
- **THEN** the generated Claude Code apply command file ends up with exactly one `model` field carrying that value, not a duplicate

### Requirement: The apply-model setting is independent of LV's own agent model configuration
The apply-model setting SHALL be distinct from, and SHALL NOT affect, the existing per-step Mastra model configuration used by LV's own agents.

#### Scenario: Apply model configured alongside existing per-step model configuration
- **WHEN** an engineer configures both an apply-model setting and an existing per-step Mastra model override
- **THEN** the apply-model setting only affects the generated Claude Code apply command file's frontmatter, and the existing per-step Mastra model configuration continues to select the model for LV's own agent calls unchanged
