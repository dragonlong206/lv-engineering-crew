# lv bootstrap

Tạo tài liệu ban đầu cho một feature chưa có docs. Đọc code từ paths được chỉ định, gọi Anthropic API trực tiếp (không qua agent — context đơn giản), sinh overview.md và design.md với header "AUTO-GENERATED". Không commit.

## Code chính

- `src/cli/bootstrap.ts`

## Khác biệt với các lệnh khác

Bootstrap dùng Anthropic SDK trực tiếp (không dùng Mastra agent + memory) vì đây là thao tác một lần, không có conversation history, không cần tool calling.
