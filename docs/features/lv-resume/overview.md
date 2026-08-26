<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

<!-- AUTO-GENERATED — verified against the current codebase. -->

# lv resume

`lv resume` is the command for picking up an existing change again. It resolves the change branch, checks it out if needed, reads the change’s persisted `state.yaml`, and prints the context summary so the engineer can continue work from the right place.

## Purpose

The command exists for two common cases:

- Return to the current change after a break, using the branch you are already on.
- Resume a specific change by ticket ID, even if the branch is only present remotely or there are multiple branch naming variants.

It is a convenience command for restoring context, not a workflow engine of its own.

## Main components

- `src/index.ts` registers `resume [ticket-id]` on the CLI.
- `src/cli/resume.ts` implements the command flow.
- `src/engine/branch-naming.ts` matches branch names to change IDs, lists candidate branch globs, and renders a fallback branch name.
- `src/integrations/git/client.ts` provides branch lookup, current-branch detection, and checkout with remote fallback.
- `src/engine/state-io.ts` reads the change’s `state.yaml` file.
- `src/cli/status.ts` provides `printStateSummary()`, which `resume` reuses to print the change context.
- `src/cli/helpers.ts` supplies the interactive selection and message helpers used during branch resolution.

## High-level flow

1. Load repository config and locate the repo root.
2. Resolve which change to resume.
   - With a ticket ID, list candidate branches from all configured branch types and filter them by matching ticket ID.
   - With no ticket ID, inspect the current branch first. If it matches a configured change branch, use that change ID. Otherwise, list all matching change branches and ask the user to choose one.
   - If a ticket ID has no matching branch, fall back to the default branch type’s rendered name for that ticket ID.
3. Check out the resolved branch.
   - `checkoutBranch()` tries a local checkout first.
   - If the branch is not local, it fetches `origin/<branch>` and creates a local tracking branch.
4. Read `docs/changes/<change-id>/state.yaml` and parse it through the state schema.
5. Print a success message, the state summary, and a reminder to continue in the coding agent workflow.

## Constraints and assumptions

- The command only works with branches that match the configured branch naming patterns.
- Matching is based on ticket ID, not on summary text in the branch name.
- When no ticket ID is provided, the command can only auto-resume if the current branch parses as a change branch.
- If the current branch does not match and there are no other change branches, the command exits with an error.
- A missing branch for an explicit ticket ID is handled best-effort by rendering the default branch name and letting git fail if that branch does not exist.
- The command does not alter workflow state. It only resolves branches and prints context.

## Current state of the code

`lv resume` is implemented and wired into the CLI. The current behavior is branch-resolution plus state-summary printing. It supports current-branch resume, ticket-ID lookup across all configured branch types, interactive disambiguation, remote-tracking checkout, and a fallback branch name when no branch is found.