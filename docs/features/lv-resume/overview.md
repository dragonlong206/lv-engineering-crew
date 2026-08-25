<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv resume

`lv resume` continues the current ticket workflow from the point where it was left off. It is a dispatcher that inspects the current ticket branch and the ticket state, then either asks the engineer for approval or advances to the next document-generation step.

## Purpose

The command exists so an engineer does not need to remember whether the next action is `answer`, `approve`, or `design`. It can resume a ticket either from the current branch or from an explicitly supplied ticket ID.

## Main components

- `src/index.ts` registers `resume [ticket-id]` on the CLI.
- `src/cli/resume.ts` implements the resume flow.
- `src/engine/branch-naming.ts` provides branch parsing and branch-name rendering.
- `src/integrations/git/client.ts` provides branch lookup and checkout.
- `src/cli/helpers.ts` provides interactive confirmation and branch selection prompts.
- `src/engine/state-io.ts` and `src/engine/state-machine.ts` are used to read ticket state and determine the current step.
- `src/cli/approve.ts` and `src/cli/design.ts` are invoked when resume decides the workflow should continue.

## High-level flow

1. Resolve the ticket branch and ticket ID.
   - If `ticket-id` is provided, the command searches local and remote branches matching any configured branch type, filters them to the requested ticket ID, then either checks out the single match, prompts when multiple matches exist, or falls back to the default branch-type name for that ticket ID.
   - If no `ticket-id` is provided, the command uses the current branch when it matches a configured ticket-branch pattern. Otherwise it lists all matching ticket branches and prompts the user to choose one.
2. Read the ticket state for the resolved ticket ID.
3. Inspect the current workflow step.
   - If the current step is in progress, print the relevant document path and ask whether to approve now.
   - If the current step is approved and is the analysis step, generate the design document.
   - If the current step is approved and is not the analysis step, report that the ticket is fully approved.
4. When approval is requested interactively, `lv resume` delegates to `lv approve` only after the user confirms.

## Constraints and assumptions

- The command only operates on branches that match the configured ticket-branch patterns.
- Branch lookup uses configured branch types, not a hardcoded branch prefix.
- When resuming by ticket ID, the command matches branches by ticket ID only and ignores branch summary text.
- If no existing branch is found for a provided ticket ID, the command renders the default branch-type name without a summary and lets checkout fail normally if that branch does not exist.
- The command does not approve a step on its own initiative.
- Resuming from a current branch that does not look like a ticket branch requires at least one existing ticket branch to select from.

## Current state of the code

The command is implemented and wired into the CLI. It currently supports interactive branch selection, best-effort checkout by ticket ID, approval prompting for an in-progress step, automatic transition to design after analysis approval, and a completion message when all steps are approved.