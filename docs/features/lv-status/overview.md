# lv status

In trạng thái hiện tại của ticket. Đọc state.yaml từ branch hiện tại, format và print.

## Code chính

- `src/cli/status.ts`
- `src/engine/state-io.ts` — readState

## Output

ticket_id, feature_ids, branch, current_step, created_at, và per-step: status, iterations, tokens, duration, model, approved_at.
