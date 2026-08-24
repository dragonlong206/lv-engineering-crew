# lv start

Starts a ticket. Fetches the record from Lark Base, validates feature IDs, creates branch `lv/<ticket-id>`, generates `01-analysis.md` via the analysis agent, initializes `state.yaml`, commits and pushes.

## Main code

- `src/cli/start.ts` — orchestration
- `src/agents/analysis-agent.ts` — generates the document
- `src/integrations/lark/client.ts` — fetch ticket
- `src/integrations/git/client.ts` — createBranch, commitAll, push
- `src/engine/state-io.ts` — writeState

## Flow

1. loadConfig → fetchTicket → validate feature dirs
2. createBranch from default_branch
3. analysisAgent.generate → write 01-analysis.md
4. writeState (status: in_progress) + commitAll + push
