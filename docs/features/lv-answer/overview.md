<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv answer

`lv answer` is the edit-and-regenerate step in the ticket workflow. It opens the current working document for the active ticket in the user's editor, waits for the engineer to make changes, then asks the appropriate agent to update the document from the edited content. It persists the updated document, records iteration metrics in ticket state, and commits the result.

## Main components

- `src/cli/answer.ts` orchestrates the command.
- `src/engine/state-machine.ts` decides whether the command can run for the current ticket step.
- `src/engine/branch-naming.ts` is used to recover the ticket ID from the current branch.
- `src/cli/helpers.ts` provides editor launching, file writing, and model output parsing helpers.
- `src/agents/analysis-agent.ts` and `src/agents/design-agent.ts` provide the update generators for analysis and design.
- `src/prompts.ts` builds the update prompts and defines the design output shape.
- `src/engine/state-io.ts` reads and writes ticket workflow state.
- `src/integrations/git/client.ts` provides the commit step.

## High-level flow

1. Load configuration and determine the repository root.
2. Read the current git branch and parse it to a ticket ID.
3. Load `docs/changes/<ticket-id>/state.yaml` and verify the workflow allows `answer`.
4. Choose the current step and corresponding file set.
5. Open the editable document in the user's configured editor.
6. Re-read the document context through the agent update prompt.
7. For analysis, write back `1.proposal.md`.
8. For design, write back `3.design.md`, `5.tasks.md`, and the current set of spec delta files under `2.specs/`.
9. Update the step record in `state.yaml`, incrementing iterations and accumulating usage and duration.
10. Stage and commit the changes with a ticket-specific message.
11. Print a reminder to review the result and either run `lv answer` again or move to approval.

## Constraints and assumptions

- The command only works on a ticket branch that matches the configured branch naming rules.
- It refuses to run if the current step is already approved.
- The workflow state is stored in `docs/changes/<ticket-id>/state.yaml` and is treated as the source of truth for command eligibility.
- The analysis step updates only `1.proposal.md`.
- The design step updates `3.design.md`, `5.tasks.md`, and `2.specs/<feature-id>.md` files derived from the agent output.
- The editor command comes from `EDITOR`, then `VISUAL`, then a platform default.
- Git commit behavior is all-or-nothing for the working tree, because the commit helper stages all changes before committing.
- The agent memory is keyed by ticket and step, so repeated runs continue the same conversation thread.

## Current state of the code

`lv answer` is implemented and wired into the CLI as a top-level command. It supports both workflow steps currently modeled by the state machine: `analysis` and `design`. The code updates documents, state, and git history end-to-end, and the command description in the CLI matches that behavior.