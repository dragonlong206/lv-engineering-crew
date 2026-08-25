# lv start

Starts a ticket. Fetches the record from Lark Base, validates feature IDs, creates a branch (named per `--type`'s pattern in `.lv.yaml`'s `branch_types`, e.g. `lv/<ticket-id>` or `hotfix/<ticket-id>`, defaulting to `default_branch_type`), generates `01-analysis.md` via the analysis agent, initializes `state.yaml`, commits and pushes.

## Main code

- `src/cli/start.ts` — orchestration
- `src/engine/branch-naming.ts` — `renderBranchName()`
- `src/agents/analysis-agent.ts` — generates the document
- `src/integrations/lark/client.ts` — fetch ticket
- `src/integrations/git/client.ts` — createBranch, commitAll, push
- `src/engine/state-io.ts` — writeState

## Flow

1. loadConfig → renderBranchName(config, ticketId, --type) (fails fast on an unknown type) → fetchTicket → validate feature dirs
2. createBranch from default_branch
3. analysisAgent.generate → write 01-analysis.md
4. writeState (status: in_progress) + commitAll + push
