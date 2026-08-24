# lv approve

Chốt bước hiện tại. Set status = approved, ghi approved_at, commit state trong cùng commit với artifact. Không tự chạy bước tiếp theo — engineer phải chủ động.

## Code chính

- `src/cli/approve.ts`
- `src/engine/state-machine.ts` — canRun('approve')
- `src/engine/state-io.ts` — writeState

## Nguyên tắc quan trọng

writeState và commitAll luôn trong cùng một lần gọi. Không có tình trạng state.yaml nói "approved" nhưng file là bản cũ.
