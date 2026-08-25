<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv design

## Architecture and layers

The feature is implemented as a CLI command layer over the workflow engine and the design agent.

- `src/cli/design.ts` handles branch validation, state loading, prompt construction, agent execution, file writes, state advancement, and git commit.
- `src/agents/design-agent.ts` configures the Mastra agent used to produce the design artifacts.
- `src/prompts.ts` defines the design prompt and the expected JSON output shape.
- `src/engine/state-machine.ts` enforces step eligibility and moves the ticket to the next workflow step.
- `src/integrations/git/client.ts` is used for current-branch detection and committing all changes.

## Data model / schema

The command reads and writes the ticket state defined in `src/types.ts`.

Relevant state fields:

- `ticket_id`: ticket identifier.
- `feature_ids`: linked feature IDs used to locate feature documentation.
- `branch`: ticket branch name.
- `current_step`: workflow step, currently one of `analysis` or `design`.
- `steps.analysis`: analysis step record, which must have `status: 'approved'` before design can run.
- `steps.design`: design step record added or updated after generation.
- step records include `status`, `iterations`, `model`, `tokens_in`, `tokens_out`, `duration_seconds`, and optional `approved_at`.

Generated files:

- `3.design.md` for the design document.
- `5.tasks.md` for the implementation checklist.
- `2.specs/<feature-id>.md` for any feature requirement deltas.

## APIs / interfaces

### CLI entrypoint

The command is exposed through `src/cli/design.ts` as `runDesign(): Promise<void>`.

Observed behavior:

- Reads the current branch and requires a matching ticket branch.
- Loads ticket state for that ticket ID.
- Calls `StateMachine.canRun('design')` before any generation work.
- Builds the prompt with the ticket ID, `1.proposal.md` path, related feature directories, and repo root.
- Calls `designAgent.generate(prompt, { memory, model })`.
- Parses the agent response as JSON into `DesignOutput`.
- Writes generated markdown files and updates state.
- Commits all changes after state persistence.

### Design agent

`src/agents/design-agent.ts` exports `designAgent`, configured with:

- id `lv-design-agent`
- name `LV Design Agent`
- description indicating it generates and updates technical design documents after approved analysis
- persistent memory using `LibSQLStore`
- tools for reading feature docs, recent doc changes, and individual doc files

### Prompt contract

`DesignOutput` in `src/prompts.ts` requires:

- `designMarkdown: string`
- `tasksMarkdown: string`
- `specDeltas: Record<string, string>`

## Key design decisions

- Design generation is blocked until analysis is approved, which keeps the workflow linear and prevents premature implementation planning.
- The agent produces multiple artifacts in one pass so the design document, task checklist, and spec deltas stay aligned.
- Spec deltas are optional and only emitted when a feature's externally observable behavior changes.
- The design step stores usage metrics in state, including token counts and duration, so execution can be tracked per run.
- The workflow writes changes directly into the ticket's changes directory and then advances the persisted state before committing.