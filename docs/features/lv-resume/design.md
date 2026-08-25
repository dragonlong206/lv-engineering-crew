<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv resume

## Architecture and layers

`lv resume` is a thin CLI orchestrator over existing ticket workflow primitives.

- CLI layer: `src/index.ts` exposes the command, and `src/cli/resume.ts` coordinates the workflow.
- Branch layer: `src/engine/branch-naming.ts` is used to recognize ticket branches and to render a branch name when only a ticket ID is known.
- Git layer: `src/integrations/git/client.ts` is used to enumerate branches and check out the resolved branch.
- State layer: `src/engine/state-io.ts` reads the persisted ticket state, and `src/engine/state-machine.ts` determines the active step.
- Action layer: `src/cli/approve.ts` and `src/cli/design.ts` are reused rather than reimplemented.

## Data model / schema

The command reads the persisted ticket state for the resolved ticket ID and inspects the current step record.

Relevant state facts observed in the code:

- The state contains a `steps` map keyed by step name.
- Each step record has a `status` field.
- `lv resume` distinguishes at least these statuses: `pending`, `in_progress`, and `approved`.
- The current step name is obtained from the state machine, not inferred directly from the filesystem.

The command also relies on branch name patterns from configuration:

- Branch types are configured in `.lv.yaml` through `branch_types` and `default_branch_type`.
- Ticket IDs are extracted from branches using configured patterns.
- Summary text in branch names is optional when parsing and omitted when rendering a fallback name.

## APIs / interfaces

### CLI interface

- `lv resume [ticket-id]`

Behavioral shape:

- With no argument, use the current branch if it matches a ticket branch.
- With no argument on a non-ticket branch, prompt the user to choose from available ticket branches.
- With a ticket ID, search across configured branch types for matching branches.

### Internal interfaces used

- `runResume(ticketId?: string): Promise<void>` in `src/cli/resume.ts`.
- `matchBranch(config, branchName)` returns a branch type and ticket ID when a branch matches.
- `branchGlobs(config)` returns glob patterns for listing candidate branches.
- `renderBranchName(config, ticketId)` renders the fallback branch name when no branch exists yet.
- `checkoutBranch(repoRoot, branchName)` checks out an existing branch, or fetches and tracks it from `origin` if needed.
- `confirm(question)` asks for a yes/no decision.
- `promptSelect(question, options)` prompts the user to choose one branch from a numbered list.

## Key design decisions

- Resume is a dispatcher, not a new workflow step. It reuses the existing approve and design commands.
- Branch resolution is ticket-ID centric. When multiple branch types exist, the command can still find the ticket by matching only the ticket ID portion.
- The command prefers safe automation. It may generate the next document automatically when the workflow is already approved, but it never approves a step without explicit confirmation.
- Fallback checkout is best-effort. If a requested ticket ID has no matching branch, the command derives the default branch name and lets git report failure if that branch is absent.
- Branch selection is interactive only when needed, keeping the common path of resuming the current ticket branch simple.
- Existing git helper behavior is reused, including remote-tracking checkout when a branch is not present locally.