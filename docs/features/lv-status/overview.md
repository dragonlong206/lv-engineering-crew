# lv status

Prints the current state of the ticket. Reads state.yaml from the current branch, formats and prints.

## Main code

- `src/cli/status.ts`
- `src/engine/state-io.ts` — readState

## Output

ticket_id, feature_ids, branch, current_step, created_at, and per-step: status, iterations, tokens, duration, model, approved_at.
