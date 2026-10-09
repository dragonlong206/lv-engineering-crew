## Why

When `lv start` splits a large ticket into sub-tasks, each sub-task is later started independently and forks from `default_branch`, so the pieces of one large feature land on the main line one by one, half-finished. Teams delivering a big feature want a long-lived "big feature" branch that collects all sub-task work, with each sub-task branching from and merging back into it.

## What Changes

- After the engineer confirms a task split, `lv start` additionally asks whether to follow the **big feature git flow**.
- If accepted: after the sub-tickets are created, `lv start` creates a branch for the parent ticket (named by the usual `branch_types` pattern, forked from the type's base branch), writes the parent's `state.yaml` marked as a big-feature branch, commits, and pushes it so sub-task branches and PRs can target it.
- If declined: today's behavior is unchanged (sub-tickets created, no parent branch).
- `lv start <sub-ticket-id>` detects that its parent ticket has a big-feature branch and forks the sub-task branch from that branch (instead of the type's base branch), recording the chosen base in the sub-task's `state.yaml` so the pull request is opened against the big-feature branch.
- `lv start` / `lv resume` output tells the engineer which branch the sub-task's PR should target.
- New optional `state.yaml` fields: `big_feature` (parent) and `base_branch` (sub-task).

## Capabilities

### New Capabilities
- `lv-start/big-feature-git-flow`: opt-in parent "big feature" branch created on a confirmed split, and sub-task branches that fork from, and target PRs to, that branch.

### Modified Capabilities
- `lv-start/task-splitting`: a confirmed split no longer always stops without a branch/`state.yaml`; when the engineer opts into the big feature git flow, the parent branch and `state.yaml` are created.

## Impact

- `src/cli/start.ts` (flow prompt, parent branch creation, sub-task base resolution), `src/cli/helpers.ts` (new confirm prompt), `src/integrations/git/client.ts` (push/read-state-from-ref helpers), `src/types.ts` (`StateSchema` fields), `src/cli/status.ts` (summary line).
- Docs: `docs/features/lv-start/{overview,design}.md`, CLAUDE.md note.
- No new config keys, no new dependencies. Requires a pushable `origin` for the parent branch to be usable by teammates (push failure is non-fatal and warned).
