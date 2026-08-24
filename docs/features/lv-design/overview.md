# lv design

Sinh tài liệu thiết kế kỹ thuật. Chỉ chạy được khi analysis đã approved. Nạp feature docs + 01-analysis.md vào context, gọi design agent, ghi 02-design.md, advance state sang bước design.

## Code chính

- `src/cli/design.ts`
- `src/agents/design-agent.ts`
- `src/engine/state-machine.ts` — canRun('design'), advance()

## Luồng

1. Check analysis.status === 'approved'
2. designAgent.generate → ghi 02-design.md
3. machine.advance() → current_step = 'design'
4. writeState + commitAll
