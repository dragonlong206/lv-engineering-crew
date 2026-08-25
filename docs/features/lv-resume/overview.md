# lv resume

Picks a ticket back up without the engineer having to remember which of `answer`/`approve`/`design` comes next. Reads `state.yaml` and either asks for approval (if the current step is in progress) or takes the next step itself (if the current step is already approved).

## Main code

- `src/cli/resume.ts`
- `src/engine/branch-naming.ts` — `matchBranch()`, `branchGlobs()`, `renderBranchName()`
- `src/integrations/git/client.ts` — `checkoutBranch()`, `listBranchesMatching()`
- `src/cli/helpers.ts` — `confirm()`, `promptSelect()`

## Flow

1. Resolve ticket ID:
   - `[ticket-id]` arg given → `listBranchesMatching()` (local + remote, globbed across every configured branch type) filtered to branches whose `matchBranch()` ticket ID matches → one match checks it out, multiple prompts via `promptSelect()`, none falls back to `renderBranchName(config, ticketId)` (the default type, same as a fresh `lv start` would create) and lets `checkoutBranch()`'s normal not-found error surface
   - no arg, current branch matches any configured type (`matchBranch()`) → use it
   - no arg, current branch doesn't match → list every ticket branch (any type) and `promptSelect()` to ask which one to resume; errors only if none exist
2. Read `state.yaml`, look at `state.steps[current_step]`
3. `in_progress` → print the doc path, ask "Approve now? [y/N]" — `y` calls `runApprove()`, `n` points at `lv answer`
4. `approved` and not the last step → call `runDesign()` directly (auto-advances the pipeline one step, then stops for review)
5. `approved` and the last step → report the ticket is fully approved

## Key invariant

Never approves on its own initiative — always asks. The only actions it takes without asking are read-only (checkout, read state) or already-safe-to-repeat (generating the next step's doc, same as running that step's command by hand).
