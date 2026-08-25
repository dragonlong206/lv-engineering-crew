# LV Engineer Crew

CLI tool for spec-driven development with human-in-the-loop. Automates the requirement analysis and technical design loop, with engineers reviewing and approving each step.

## Workflow (phase 1)

```
lv init <doc-paths...>   →  split requirement docs into features, allocate Fxxxx IDs, draft overview.md
lv bootstrap <feature-id> →  ground a feature's docs in the actual code (overview.md + design.md)

lv start <ticket-id>   →  generate 01-analysis.md + open questions
lv answer              →  engineer answers, agent updates doc
lv approve             →  lock analysis
lv design              →  generate 02-design.md + open questions
lv answer              →  engineer answers, agent updates doc
lv approve             →  lock design → create MR
```

`lv init`/`lv bootstrap` populate `docs/features/` and are independent of any ticket — run them once per feature, whenever needed. `lv start` and onward operate per ticket and require every feature it references to already have docs.

## Installation

Requires: Node.js >= 20

```bash
git clone <repo>
cd lv-engineer-crew
npm install
npm run build
npm link   # install lv globally
```

## Configuration

### 1. Repo config (`.lv.yaml` at the root of the target repo)

```yaml
lark:
  base_id: "YOUR_BASE_ID"
  table_id: "YOUR_TABLE_ID"
  feature_id_field: "Feature ID"   # column name for feature IDs in Lark Base

default_branch: main

model: openai/gpt-4o   # default model

models:                # per-step model — omit to use the default
  analysis: openai/gpt-4o
  design: openai/gpt-4o
  bootstrap: openai/gpt-4o-mini
  init: openai/gpt-4o-mini

feature_id_prefix: "F"   # used by `lv init` to allocate feature IDs (e.g. F0001)
feature_id_digits: 4
```

### 2. Credentials

**Option A — local override file (recommended)**

```bash
cp .lv.local.yaml.sample .lv.local.yaml
# fill in real values — file is gitignored
```

```yaml
lark_token: t-xxx
openai_api_key: sk-xxx
# anthropic_api_key: sk-ant-xxx  # only if using Anthropic models
```

**Option B — env vars**

```bash
export LARK_TOKEN=t-xxx
export OPENAI_API_KEY=sk-xxx
```

Env vars take priority over `.lv.local.yaml`.

## Doc structure in the target repo

```
docs/
  features/
    INDEX.md                      # feature list, feature-id → name/path
    <feature-id>/
      overview.md                 # current state of the feature
      design.md                   # architecture, data model, API contract
  changes/
    <ticket-id>/
      01-analysis.md              # requirement analysis document
      02-design.md                # technical design document
      state.yaml                  # workflow state (single source of truth)
```

## Commands

### `lv init <doc-paths...>`

Analyze requirement documents (BRD/SRD/SSD, UI design/prototype references) and split them into features.

```bash
lv init docs/requirements/checkout-brd.pdf docs/requirements/checkout-srd.md
lv init requirements.md https://figma.com/file/xxx   # a URL is recorded as an unfetched reference
```

- Accepts `.md`, `.txt`, `.pdf`, `.docx`, `.html`/`.htm`, or a URL (not fetched, cited as a reference)
- Splits the combined input into distinct features and allocates a fresh `Fxxxx` ID per feature (`--id-prefix`/`--id-digits` override `.lv.yaml`'s defaults for one run)
- Writes a requirements-derived draft `docs/features/<id>/overview.md` per feature (purpose, scope, constraints, source references — no code involved yet) and updates `docs/features/INDEX.md`
- **Does not commit** — engineer reviews and commits manually
- Next step: `lv bootstrap <feature-id>` for each new ID, to ground the draft in code

### `lv bootstrap <feature-id> [--paths <paths>] [--name <name>] [--description <description>]`

Generate or refine a feature's docs from the actual code.

```bash
lv bootstrap checkout-flow --paths src/checkout,src/cart      # explicit paths — reads and summarizes exactly those files
lv bootstrap F0001                                             # no --paths — agent explores the repo itself
lv bootstrap F0002 --name "Order refunds" --description "Lets support agents issue partial/full refunds from the order detail page"
```

Two modes:
- **`--paths` given**: reads code at the specified paths and generates `overview.md`/`design.md` from that content directly (fast, deterministic, no repo exploration).
- **`--paths` omitted**: an agent autonomously explores the repository (list/read/search tools, similar to how Claude Code explores a codebase) to ground the docs in what it actually finds. If `docs/features/<feature-id>/overview.md`/`design.md` already exist (e.g. drafted by `lv init`), it **refines** them — re-verifying any code-related claims against fresh exploration rather than trusting the draft — instead of overwriting from scratch. `--name`/`--description` seed the exploration with a starting hint when there's no existing draft to work from (ignored, with a warning, if `--paths` is also given).

Both modes:
- Generate `overview.md` and `design.md` with an "AUTO-GENERATED" header
- Update `docs/features/INDEX.md`
- **Do not commit** — engineer reviews and commits manually

### `lv start <ticket-id>`

Start a new ticket.

```bash
lv start PROJ-123
```

- Fetches the record from Lark Base
- Validates that the feature ID exists in `docs/features/`
- Creates branch `lv/PROJ-123` from the default branch
- Generates `01-analysis.md` with open questions
- Commits and pushes the branch

### `lv answer`

Opens the current document in the editor for the engineer to answer questions, then the agent updates the document.

```bash
lv answer
```

- Opens `$EDITOR` (fallback: `notepad` on Windows, `vi` on Unix)
- After the editor closes, the agent re-reads and updates the document
- Commits the result
- Can be run multiple times until all questions are resolved

### `lv approve`

Lock the current step.

```bash
lv approve
```

- Sets `status: approved` in `state.yaml`
- Commits state and artifact in the same commit
- Prints the next command to run

### `lv design`

Generate the technical design document. Only runs after analysis has been approved.

```bash
lv design
```

- Loads context: feature docs + approved `01-analysis.md`
- Generates `02-design.md` with open questions
- Commits the result

### `lv status`

Print the current state of the ticket.

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

## Prerequisites to start a ticket

The Lark Base record must have:
- A value in the Feature ID column (column name declared in `.lv.yaml`)
- A Feature ID that points to an existing directory in `docs/features/`

If the feature has no docs yet, run `lv init` (from requirement docs) or `lv bootstrap` (from existing code) first.

## Tracing

```bash
npm run mastra   # open localhost:4111 to view traces
```

## Stack

- TypeScript + Node.js
- [Mastra](https://mastra.ai) — agent, thread memory, MCP client, OTel tracing
- LibSQL (SQLite local) — agent conversation history
- `state.yaml` in git — single source of truth for business state
