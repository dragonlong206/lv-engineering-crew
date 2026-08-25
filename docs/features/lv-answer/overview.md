# lv answer

Q&A loop. Opens the current document (`01-analysis.md` or `02-plan.md`) in the default editor, re-reads it after the engineer closes the editor, calls the agent to update the document based on the new content, commits.

## Main code

- `src/cli/answer.ts` — orchestration
- `src/agents/analysis-agent.ts` / `design-agent.ts` — update the document
- `src/engine/state-machine.ts` — canRun('answer')
- `src/cli/helpers.ts` — openEditor

## Flow

1. Identify ticket from branch name (lv/<ticket-id>)
2. Read state → check canRun
3. Open editor with current document
4. Re-read file → agent.generate with existing thread
5. Write updated file, increment iterations, commit
