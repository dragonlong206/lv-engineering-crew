# lv start

Lệnh khởi đầu một ticket. Fetch record từ Lark Base, validate feature IDs, tạo branch `lv/<ticket-id>`, sinh `01-analysis.md` bằng analysis agent, init `state.yaml`, commit và push.

## Code chính

- `src/cli/start.ts` — orchestration
- `src/agents/analysis-agent.ts` — agent sinh tài liệu
- `src/integrations/lark/client.ts` — fetch ticket
- `src/integrations/git/client.ts` — createBranch, commitAll, push
- `src/engine/state-io.ts` — writeState

## Luồng

1. loadConfig → fetchTicket → validate feature dirs
2. createBranch từ default_branch
3. analysisAgent.generate → ghi 01-analysis.md
4. writeState (status: in_progress) + commitAll + push
