<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv design

Generates the implementation plan for a ticket after analysis has been approved. It reads the approved analysis document, loads related feature documentation, asks the design agent to produce the design artifacts, writes them to the ticket's changes directory, advances workflow state, and commits the result.

## Purpose of the feature

- Turn approved analysis into implementation-ready design output.
- Produce the ticket-level design document and task checklist.
- Emit spec delta files only when the ticket changes feature requirements.

## Main components

- `src/cli/design.ts` runs the command, validates state, invokes generation, writes files, and commits changes.
- `src/agents/design-agent.ts` defines the agent used to draft the design artifacts.
- `src/prompts.ts` defines the design prompt and the `DesignOutput` shape.
- `src/engine/state-machine.ts` gates the command with `canRun('design')` and advances the ticket state.

## High-level flow

1. Resolve the current git branch and verify it matches a ticket branch.
2. Load the ticket state and confirm analysis is approved before proceeding.
3. Collect feature directories for the ticket's linked feature IDs when they exist on disk.
4. Build a design prompt from the approved analysis path and related feature docs.
5. Call the design agent and parse strict JSON output.
6. Write `3.design.md`, `5.tasks.md`, and any `2.specs/<feature-id>.md` files under the ticket's changes directory.
7. Advance the workflow state, record design-step usage metrics, persist state, and commit all changes.

## Constraints and assumptions

- The command only runs on a branch that matches a ticket branch.
- Analysis must be approved first. Otherwise the command exits with an error.
- The design agent output is expected to be strict JSON with `designMarkdown`, `tasksMarkdown`, and `specDeltas` fields.
- Spec delta files are created only for feature IDs returned by the agent.
- The workflow currently has only `analysis` and `design` steps in code.

## Current state of the code

- The command is implemented in `src/cli/design.ts` and is wired to `designAgent.generate(...)`.
- The agent uses memory storage backed by the local LV database path and includes feature-doc, recent-changes, and document-reader tools.
- The state machine allows design only after analysis is approved, and `advance()` moves the ticket from `analysis` to `design`.
- Generated design output is written to `3.design.md`, `5.tasks.md`, and `2.specs/*.md` in the ticket changes directory.
- The commit message format is `lv: design <ticketId> — draft`.
- The docs index lists this feature as the design step that generates a design doc after analysis is approved.