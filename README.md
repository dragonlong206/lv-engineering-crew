# LV Engineer Crew

CLI tool hỗ trợ spec-driven development với human-in-the-loop. Tự động hóa vòng lặp phân tích yêu cầu và thiết kế kỹ thuật, có engineer review và chốt từng bước.

## Quy trình (giai đoạn 1)

```
lv start <ticket-id>   →  sinh 01-analysis.md + câu hỏi
lv answer              →  engineer trả lời, agent cập nhật
lv approve             →  chốt analysis
lv design              →  sinh 02-design.md + câu hỏi
lv answer              →  engineer trả lời, agent cập nhật
lv approve             →  chốt design → tạo MR
```

## Cài đặt

Yêu cầu: Node.js >= 20

```bash
git clone <repo>
cd lv-engineer-crew
npm install
npm run build
npm link   # cài lệnh lv global
```

## Cấu hình

### 1. Config repo (`.lv.yaml` ở root của repo đích)

```yaml
lark:
  base_id: "YOUR_BASE_ID"
  table_id: "YOUR_TABLE_ID"
  feature_id_field: "Feature ID"   # tên cột Feature ID trong Lark Base

default_branch: main

model: openai/gpt-4o   # model mặc định

models:                # model per-step — bỏ trống để dùng model mặc định
  analysis: openai/gpt-4o
  design: openai/gpt-4o
  bootstrap: openai/gpt-4o-mini
```

### 2. Credentials (`~/.config/lv/config.yaml` hoặc env vars)

```yaml
lark_token: t-xxx
openai_api_key: sk-xxx
```

Hoặc:

```bash
export LARK_TOKEN=t-xxx
export OPENAI_API_KEY=sk-xxx
```

Nếu dùng Anthropic models ở bất kỳ step nào, thêm:

```bash
export ANTHROPIC_API_KEY=sk-ant-xxx
```

Env vars được ưu tiên hơn config file.

## Cấu trúc docs trong repo đích

```
docs/
  features/
    INDEX.md                      # danh sách features, map feature-id → tên/path
    <feature-id>/
      overview.md                 # trạng thái hiện tại của feature
      design.md                   # kiến trúc, data model, API contract
  changes/
    <ticket-id>/
      01-analysis.md              # tài liệu phân tích yêu cầu
      02-design.md                # tài liệu thiết kế kỹ thuật
      state.yaml                  # trạng thái workflow (nguồn sự thật duy nhất)
```

## Các lệnh

### `lv bootstrap <feature-id> --paths <paths>`

Tạo docs ban đầu cho feature chưa có docs, từ code có sẵn.

```bash
lv bootstrap checkout-flow --paths src/checkout,src/cart
```

- Đọc code ở các đường dẫn chỉ định
- Sinh `overview.md` và `design.md` với header "AUTO-GENERATED"
- Cập nhật `docs/features/INDEX.md`
- **Không commit** — engineer tự review và commit

### `lv start <ticket-id>`

Bắt đầu một ticket mới.

```bash
lv start PROJ-123
```

- Fetch record từ Lark Base
- Validate feature ID tồn tại trong `docs/features/`
- Tạo branch `lv/PROJ-123` từ default branch
- Sinh `01-analysis.md` kèm danh sách câu hỏi
- Commit và push branch

### `lv answer`

Mở file hiện tại trong editor để engineer trả lời câu hỏi, sau đó agent cập nhật tài liệu.

```bash
lv answer
```

- Mở `$EDITOR` (fallback: `notepad` trên Windows, `vi` trên Unix)
- Sau khi đóng editor, agent đọc lại và cập nhật tài liệu
- Commit kết quả
- Có thể chạy nhiều lần cho đến khi hết câu hỏi

### `lv approve`

Chốt bước hiện tại.

```bash
lv approve
```

- Set `status: approved` trong `state.yaml`
- Commit state và artifact trong cùng một commit
- In ra lệnh tiếp theo cần chạy

### `lv design`

Sinh tài liệu thiết kế kỹ thuật. Chỉ chạy được sau khi analysis đã approve.

```bash
lv design
```

- Nạp context: feature docs + `01-analysis.md` đã chốt
- Sinh `02-design.md` kèm câu hỏi
- Commit kết quả

### `lv status`

In trạng thái hiện tại của ticket.

```bash
lv status
```

```
Ticket:    PROJ-123
Features:  checkout-flow
Branch:    lv/PROJ-123
Step:      design

Steps:
  analysis   approved     iter=3  tokens=12,400  8.2s  model=openai/gpt-4o
  design     in_progress  iter=1  tokens=4,100   3.5s  model=openai/gpt-4o
```

## Điều kiện để một ticket có thể start

Ticket trong Lark Base phải có:
- Cột Feature ID (tên cột khai báo trong `.lv.yaml`) có giá trị
- Feature ID trỏ tới thư mục tồn tại trong `docs/features/`

Nếu feature chưa có docs, chạy `lv bootstrap` trước.

## Tracing

```bash
npm run mastra   # mở localhost:4111 để xem traces
```

## Stack

- TypeScript + Node.js
- [Mastra](https://mastra.ai) — agent, thread memory, MCP client, OTel tracing
- LibSQL (SQLite local) — conversation history của agent
- `state.yaml` trong git — nguồn sự thật duy nhất về business state
