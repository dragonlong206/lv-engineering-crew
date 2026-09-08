## Purpose

Gives the engineer visibility into what `lv`'s Mastra agents send to and receive from the LLM — prompts, tool calls, and results — by recording traces for every agent run, toggleable per environment via `.lv.yaml`.

## ADDED Requirements

### Requirement: Tracing is configurable via `.lv.yaml`

The system SHALL read a `tracing.enabled` boolean from `.lv.yaml` (via `.lv.local.yaml`/env overrides per the existing config-merge precedence) to control whether agent runs are traced. The setting SHALL default to `true` when `tracing` or `tracing.enabled` is omitted from config.

#### Scenario: No tracing config present

- **WHEN** `.lv.yaml` has no `tracing` key
- **THEN** tracing is enabled and agent runs are recorded

#### Scenario: Tracing explicitly disabled

- **WHEN** `.lv.yaml` sets `tracing: { enabled: false }`
- **THEN** no traces are recorded for any agent run, and no observability instance is attached

#### Scenario: Tracing explicitly enabled

- **WHEN** `.lv.yaml` sets `tracing: { enabled: true }`
- **THEN** traces are recorded for agent runs, identically to the default (omitted-key) behavior

### Requirement: Agent runs are traced when tracing is enabled

When tracing is enabled, every agent `lv` constructs for `lv bootstrap` (the throwaway single-shot agent and the tool-equipped codebase-scan agent) and `lv start` (the feature-match and feature-split agents) SHALL be traced, capturing at least the prompt(s) sent to the LLM, any tool calls made and their results, and the final response.

#### Scenario: Bootstrap agent run is traced

- **WHEN** tracing is enabled and `lv bootstrap <feature-id>` runs (either `--paths` or autonomous-scan mode)
- **THEN** a trace recording that run's LLM prompt(s), any tool calls, and the response is persisted

#### Scenario: Start agent runs are traced

- **WHEN** tracing is enabled and `lv start` runs its feature-match or feature-split agent
- **THEN** a trace recording that run's LLM prompt(s) and response is persisted

### Requirement: Traces are inspectable without additional setup

Traces SHALL be persisted to the same local store `lv` already uses (no new external service, credential, or store configuration required), and SHALL be viewable through the existing `npm run mastra` dev server.

#### Scenario: Inspecting a trace after a run

- **WHEN** tracing is enabled and the engineer runs `npm run mastra` after an agent run
- **THEN** the dev server shows that run's trace (prompts, tool calls, response) without any extra configuration beyond `.lv.yaml`

### Requirement: Disabling tracing adds no runtime dependency on an observability backend

When tracing is disabled, agent runs SHALL behave exactly as they did before tracing was introduced — no observability instance is constructed or attached, and no trace data is written.

#### Scenario: Tracing disabled leaves agent behavior unchanged

- **WHEN** `tracing.enabled` is `false` and any `lv bootstrap`/`lv start` agent runs
- **THEN** the run completes with the same output as before tracing existed, and no trace records are written
