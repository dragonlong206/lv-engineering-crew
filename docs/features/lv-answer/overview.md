# lv answer

Vòng lặp Q&A. Mở file hiện tại (`01-analysis.md` hoặc `02-design.md`) trong editor mặc định, đọc lại sau khi engineer đóng, gọi agent để cập nhật tài liệu dựa trên nội dung mới, commit.

## Code chính

- `src/cli/answer.ts` — orchestration
- `src/agents/analysis-agent.ts` / `design-agent.ts` — cập nhật tài liệu
- `src/engine/state-machine.ts` — canRun('answer')
- `src/cli/helpers.ts` — openEditor

## Luồng

1. Xác định ticket từ branch name (lv/<ticket-id>)
2. Đọc state → kiểm tra canRun
3. Mở editor với file hiện tại
4. Đọc lại file → agent.generate với thread cũ
5. Ghi file mới, increment iterations, commit
