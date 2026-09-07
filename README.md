# LV Engineer Crew

CLI tool for spec-driven development with human-in-the-loop. LV hands the ticket/description context to [OpenSpec](https://github.com/Fission-AI/OpenSpec), which drives the explore → propose → spec → design → tasks → apply loop through your coding agent.

## Get started

```bash
git clone <repo>
cd lv-engineer-crew
npm install
npm run build
npm link                          # installs the `lv` binary globally

cd /path/to/target-repo
cp /path/to/lv-engineer-crew-repo/.lv.local.yaml.sample .lv.local.yaml   # then fill in configs and real credentials — file is gitignored — see Configuration below
lv init --tool claude             # install/configure OpenSpec, wire it to LV's context
lv bootstrap <feature-id> --description "feature description"  # generate feature docs from an existing codebase that doesn't have any yet
lv start <ticket-id>             #  fetch the ticket from Lark, create docs/changes/<ticket-id>/state.yaml
# or
lv start --description "..."     #  create docs/changes/<change-id>/state.yaml from free text, no ticket
```

Then continue with your coding agent's OpenSpec workflow (e.g. `/opsx:propose`) — see [Workflow](#workflow-phase-1) below for the full loop, [Installation](#installation) and [Configuration](#configuration) for details, and [Commands](#commands) for the full command reference.

## Workflow (phase 1)

```
lv init [--tool <tool>]      →  install/configure OpenSpec for a coding agent, wire it to LV's context, for example: lv init --tool claude,cursor,codex
lv bootstrap <feature-id>    →  ground a feature's docs in the actual code (overview.md + design.md)

lv start <ticket-id>             →  fetch the ticket from Lark, create docs/changes/<ticket-id>/state.yaml
lv start --description "..."     →  create docs/changes/<change-id>/state.yaml from free text, no ticket

<your coding agent's OpenSpec workflow — e.g. /opsx:propose, /opsx:apply>
    →  explore, propose, spec, design, tasks, review, and implement,
       with LV's feature docs and state.yaml loaded automatically as context
```

`lv init`/`lv bootstrap` populate `docs/features/` and OpenSpec's own install and are independent of any ticket — run them once per repo/feature, whenever needed. `lv start` creates a change's context; everything after that (propose, spec, design, tasks, apply) is driven by OpenSpec through your coding agent, not by a further `lv` command. There is no `lv approve` — review and advance using OpenSpec's own workflow.

Coming back to a change later (after a break, or on a different machine)? Run `lv resume [ticket-id]` to check out its branch and print its `state.yaml` context.

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
  feature_id_field: "Feature ID" # column name for feature IDs in Lark Base
  title_field: "Title" # column name used as the ticket title (branch {summary}, analysis prompt)
  # ui_design_field: "UI Design" # column holding a ticket's UI design reference — omit to skip capture

default_branch: main

# Branch naming per type — {ticket_id} and {summary} are the only placeholders
# ({summary} is a slug of the ticket title, filled in by `lv start`). Omit to
# use the built-in default:
#   { feature: "feature/{ticket_id}-{summary}", hotfix: "hotfix/{ticket_id}-{summary}" }
#
# An entry can be a plain pattern string (forks from default_branch above), or
# an object with a base_branch to fork that type from something else instead —
# e.g. a gitflow-style repo where hotfixes branch off master while features
# branch off develop:
branch_types:
  feature:
    pattern: "feature/{ticket_id}-{summary}"
    base_branch: develop
  hotfix:
    pattern: "hotfix/{ticket_id}-{summary}"
    base_branch: master
default_branch_type: feature # used when `lv start` is run without --type

model: openai/gpt-4o # default model

models: # per-step model — omit to use the default
  bootstrap: openai/gpt-4o-mini

feature_id_prefix: "F" # used by `lv start`'s inline feature bootstrap to allocate feature IDs (e.g. F0001)
feature_id_digits: 4

# Which files `lv bootstrap`/`lv init` read from the target repo.
# Omit either to use the built-in default, which already covers a broad set
# of stacks (TS/JS, Python, Go, Java/Kotlin, Ruby, Rust, C#/.NET/ASP.NET,
# PHP, C/C++, Swift). Override for a stack the default doesn't cover.
scan_extensions: [cs, vb, cshtml, razor, csproj, sln, json, xml, config]
scan_skip_dirs: [bin, obj, .vs, packages, node_modules, .git]
```

**UI Design field** (`lark.ui_design_field`): if a ticket carries a UI design reference — a Figma link, an HTML prototype, or an attached image/PDF — point this at that Lark Base column and `lv start` captures it automatically. It works regardless of the column's type (plain text/URL field, a Lark attachment field with one or more files, or a Lark URL-type field) — `lv` normalizes whatever shape it reads into a flat list of references. Captured references land in `docs/changes/<change-id>/state.yaml` (`ui_design`) and, when a referenced feature is bootstrapped inline, in that feature's generated docs too. `lv` only captures the reference — it never fetches or analyzes the design itself. `lv init` also patches your coding agent's `/opsx:propose` workflow so that when it writes the proposal, it attempts to view the referenced design and reflect what it finds — preferring the [Figma Dev Mode MCP Server](https://developers.figma.com/docs/figma-mcp-server/) for a Figma link when you have one configured, otherwise fetching the URL or reading a local file directly, and falling back to just citing the reference if it can't be reached. Omit `ui_design_field` to skip this entirely.

### 2. Credentials

**Option A — local override file (recommended)**

```bash
cp .lv.local.yaml.sample .lv.local.yaml
# fill in real values — file is gitignored
```

```yaml
lark_app_id: cli_xxx
lark_app_secret: xxx
openai_api_key: sk-xxx
# anthropic_api_key: sk-ant-xxx  # only if using Anthropic models
```

**Option B — env vars**

```bash
export LARK_APP_ID=cli_xxx
export LARK_APP_SECRET=xxx
export OPENAI_API_KEY=sk-xxx
```

Env vars take priority over `.lv.local.yaml`.

`lark_app_id`/`lark_app_secret` come from a custom app on the Lark Open Platform (open.larksuite.com → your app → Credentials & Basic Info), added as a collaborator on the target Base with Bitable read permission. `lv start` exchanges them for a short-lived `tenant_access_token` per request via the [internal tenant access token API](https://open.larksuite.com/document/server-docs/getting-started/api-access-token/auth-v3/tenant_access_token_internal) — no long-lived token to manage or rotate.

## Doc structure in the target repo

```
docs/
  features/
    INDEX.md                      # feature list, feature-id → name/path
    <feature-id>/
      overview.md                 # current state of the feature
      design.md                   # architecture, data model, API contract
  changes/
    <change-id>/
      state.yaml                  # ticket/description context for OpenSpec (LV's only artifact here)

openspec/
  changes/<change-id>/            # proposal.md, specs/, design.md, tasks.md — owned by OpenSpec
```

`<change-id>` is a ticket ID for ticket-based starts, or a slug derived from the description for description-based ones — the same name identifies both `docs/changes/<change-id>/` and the OpenSpec change under `openspec/changes/<change-id>/`.

## Commands

### `lv init [--tool <tool>]`

Install and configure [OpenSpec](https://github.com/Fission-AI/OpenSpec) for a coding agent, wired to LV's context.

```bash
lv init --tool claude,codex   # install/configure OpenSpec for Claude Code and Codex
lv init                 # no --tool — OpenSpec's own interactive prompt runs
```

- Delegates entirely to the OpenSpec CLI (`openspec init --tools <tool>`) — `lv` does not hardcode a list of supported coding agents; whatever `openspec init --help` supports, `--tool` accepts. Refer to [OpenSpec's supported tools](https://github.com/Fission-AI/OpenSpec/blob/main/docs/supported-tools.md)
- Idempotently appends a pointer to OpenSpec's project-wide `context:` (`openspec/config.yaml`) naming `docs/features/<feature-id>/{overview.md,design.md}` and the current change's `docs/changes/<change-id>/state.yaml`, so OpenSpec's explore/propose/apply workflows load them automatically instead of you pasting them into every prompt
- Idempotently patches the generated `/opsx:propose` workflow so, when a change's `state.yaml` has a UI design reference, it analyzes it while writing the proposal (see the UI Design field above) — scoped to `/opsx:propose` only, not every workflow
- Run once per repo (re-running is safe — the OpenSpec install and both patches above are idempotent)

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

### `lv start <ticket-id> [--type <type>]` / `lv start --description "<text>" [--type <type>]`

Start a new change, from a Lark ticket or from free text.

```bash
lv start PROJ-123                                  # fetch PROJ-123 from Lark Base
lv start PROJ-123 --type hotfix                    # e.g. hotfix/PROJ-123-fix-login-bug
lv start --description "Let support issue refunds" # no Lark ticket — change-id slugified from the text
```

By ticket ID:

- Fetches the record from Lark Base; feature IDs with no `docs/features/<id>/` yet are bootstrapped inline (see `lv bootstrap`'s autonomous-scan mode) with a human review gate before continuing
- Creates the branch (named per `--type`'s pattern in `.lv.yaml`'s `branch_types`, or `default_branch_type` if omitted, with `{summary}` filled in from the ticket title) from that type's configured `base_branch`, or `default_branch` if the type has none configured
- Writes `docs/changes/<ticket-id>/state.yaml` with the ticket's title, description, feature IDs, and (when `lark.ui_design_field` is configured and set) its UI design reference — this is LV's only artifact for the change; no analysis document is generated
- Commits and pushes the branch

By description:

- No Lark fetch — the change-id is a slug of a short title derived from the description's first line
- Creates the branch the same way, using the change-id in place of a ticket ID
- Writes `docs/changes/<change-id>/state.yaml` with the same shape, `description` set and `ticket_id` omitted
- Commits and pushes the branch

Either way, continue with your coding agent's OpenSpec workflow (e.g. `/opsx:propose`) — it reads `docs/features/` and this `state.yaml` automatically once `lv init` has wired the context pointer.

### `lv resume [ticket-id]`

Check out a change's branch and print its `state.yaml` context — for picking a change back up after a break, or on a different machine.

```bash
lv resume            # uses the current branch
lv resume PROJ-123   # finds and checks out PROJ-123's branch, whatever type it is
```

- Recognizes a branch under any configured type (`feature/PROJ-123-...`, `hotfix/PROJ-123-...`, ...), not just the default
- Given a ticket ID: finds all its branches across every type (local and remote) by ticket ID alone, ignoring the `{summary}` suffix; one match checks it out directly, multiple matches asks you to pick, no matches falls back to the default type's rendered name
- Given no ticket ID and the current branch isn't a change branch: lists every change branch found (any type) and asks which one to resume, instead of just failing
- Prints the resolved change's `state.yaml` summary and a reminder to continue via your coding agent's OpenSpec workflow

### `lv status`

Print the current change's `state.yaml` context.

```bash
lv status
```

```
Change:      PROJ-123
Ticket:      PROJ-123
Title:       Fix login redirect loop
Description: Users get bounced back to /login after a successful SSO callback.
Features:    checkout-flow
Branch:      feature/PROJ-123-fix-login-redirect-loop
Created:     2026-08-26T09:02:00.000Z
Version:     0.1.0
```

## Prerequisites to start a ticket

For a ticket-based `lv start`, the Lark Base record's Feature ID field is optional — an empty field or a feature with no `docs/features/<id>/` directory is bootstrapped inline rather than treated as an error.

## Tracing

```bash
npm run mastra   # open localhost:4111 to view traces
```

## Stack

- TypeScript + Node.js
- [Mastra](https://mastra.ai) — agent, thread memory, MCP client, OTel tracing
- LibSQL (SQLite local) — agent conversation history
- `state.yaml` in git — single source of truth for business state
