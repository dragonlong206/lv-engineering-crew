<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# Design

## Architecture and layers

`lv answer` is a CLI orchestration layer over three concerns:

- workflow control through `StateMachine`
- document editing and regeneration through Mastra agents
- persistence through the filesystem, state files, and git commits

The command does not construct a new workflow model. It reads the current ticket state from disk, uses the current branch name to identify the ticket, and dispatches to step-specific update logic.

The implementation branches on the active workflow step:

- `analysis` updates the single proposal document
- `design` updates the design document, task checklist, and per-feature spec deltas

## Data model / schema

The command reads and writes `State` from `state.yaml` using the schema defined in `src/types.ts`.

Relevant fields used by `lv answer`:

- `ticket_id`
- `current_step`, which is either `analysis` or `design`
- `steps.analysis`
- `steps.design`

Each step record tracks:

- `status`
- `iterations`
- `model`
- `tokens_in`
- `tokens_out`
- `duration_seconds`
- `approved_at` when present

When the command runs, it updates the current step record by:

- ensuring the step stays `in_progress`
- incrementing `iterations`
- storing the model used for the run
- accumulating token usage
- accumulating elapsed duration

For the design step, the agent output is parsed as JSON with this shape from `src/prompts.ts`:

- `designMarkdown`
- `tasksMarkdown`
- `specDeltas`, a map from feature ID to file contents

## APIs / interfaces

The command is exposed as `lv answer` in `src/index.ts`.

Key internal interfaces used by the command:

- `StateMachine.canRun('answer')` to validate whether the command can proceed
- `matchBranch(config, branchName)` to recover the ticket ID from the current branch
- `openEditor(filePath)` to hand control to the user
- `analysisAgent.generate(...)` for analysis updates
- `designAgent.generate(...)` for design updates
- `commitAll(repoRoot, message)` to create the git commit

Prompt builders used for regeneration:

- `buildAnalysisUpdatePrompt(ticketId, analysisFilePath, step)`
- `buildDesignUpdatePrompt(ticketId, designFilePath, tasksFilePath)`

## Key design decisions

- The command derives the ticket ID from the branch rather than accepting one as input, so it always acts on the checked-out ticket.
- Workflow validity is enforced before editing, so approved steps cannot be modified through `lv answer`.
- The editor is opened before regeneration, so the user's local edits become the source input for the agent update pass.
- Analysis and design are handled separately because they update different document sets and use different agent output formats.
- Design updates regenerate the full design bundle, including spec deltas, so the files stay synchronized with the latest edited design document.
- Agent runs are stateful per ticket and step, which lets repeated answer cycles reuse conversation context.
- The command commits after writing state and documents, so each iteration is captured as a git checkpoint.
