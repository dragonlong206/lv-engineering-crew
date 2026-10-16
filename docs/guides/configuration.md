# Configuration

## 1. Repo config (`.lv.yaml` at the root of the target repo)

```yaml
lark:
  base_id: "YOUR_BASE_ID"
  table_id: "YOUR_TABLE_ID"
  feature_id_field: "Feature ID" # column name for feature IDs in Lark Base
  title_field: "Title" # column name used as the ticket title (branch {summary}, analysis prompt)
  # ui_design_field: "UI Design" # column holding a ticket's UI design reference — omit to skip capture
  # attachment_field: "Attachment" # Lark attachment column — omit to skip; files are downloaded into docs/changes/<change-id>/attachments/
  # subtask_parent_field: "Parent" # Link field back to the parent ticket — sub-tickets created by a split inherit features/project through it
  # assignee_field: "Assignee" # person or link field — copied onto sub-tickets created by a split; omit to skip
  # order_field: "Order" # column copied onto sub-tickets created by a split; omit to skip

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

**Attachment field** (`lark.attachment_field`): point this at the Lark Base attachment column holding a ticket's documents, screenshots, or videos. Unlike `ui_design_field` (which only records a reference), `lv start` downloads each file into `docs/changes/<change-id>/attachments/` and records the repo-relative paths in `state.yaml`, so your coding agent can read them. For a sub-ticket created by a split, the parent ticket's attachments are merged in too. Omit it to skip attachment capture.

## 2. Credentials

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
