# lv design

Generates the technical design document. Only runs when analysis is approved. Loads feature docs + 01-analysis.md into context, calls the design agent, writes 02-design.md, advances state to the design step.

## Main code

- `src/cli/design.ts`
- `src/agents/design-agent.ts`
- `src/engine/state-machine.ts` — canRun('design'), advance()

## Flow

1. Check analysis.status === 'approved'
2. designAgent.generate → write 02-design.md
3. machine.advance() → current_step = 'design'
4. writeState + commitAll
