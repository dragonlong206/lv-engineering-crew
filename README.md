# LV Engineer Crew

**Turn tickets into specs, specs into code — and keep your feature docs true to the code, automatically.**

<!-- GitHub plays the video; npmjs.com strips <video> and shows the poster image, linked to the video. -->
<video src="https://github.com/user-attachments/assets/b820eb34-4436-4a4b-b0b2-f76ccff42e3f" controls muted width="100%">
  <a href="https://github.com/user-attachments/assets/b820eb34-4436-4a4b-b0b2-f76ccff42e3f"><img src="https://raw.githubusercontent.com/dragonlong206/lv-engineering-crew/main/docs/assets/lv-demo-poster.jpg" alt="LV Engineer Crew demo — click to watch"></a>
</video>

LV Engineer Crew (`lv`) is a CLI for **spec-driven development with AI coding agents** (Claude Code, Cursor, Codex, ...). It gives your coding agent the one thing it usually lacks: **accurate, up-to-date context** about the feature it's changing and the ticket it's working on.

```bash
npm install -g lv-engineer-crew
```

## Why LV?

AI coding agents are fast, but they start every task cold. They don't know what a feature is supposed to do, why it was designed that way, or what the ticket actually asks for — so you end up pasting context into every prompt, and the docs you do have drift out of date the moment code merges.

LV fixes this with two ideas:

- **Every feature has living docs** — `docs/features/<feature-id>/overview.md` and `design.md`, generated from the real code and loaded into your agent's context automatically.
- **Docs stay in sync with the code** — when a change is archived, the docs of every feature it touched are refreshed. Run `/opsx:archive` yourself, or [add LV's CI workflow](docs/guides/ci.md) to your repo and it happens automatically when a PR merges.

Planning and implementation are driven by [OpenSpec](https://github.com/Fission-AI/OpenSpec) inside your coding agent (explore → propose → spec → design → tasks → apply). LV sets up OpenSpec, feeds it the right context, and refreshes the docs when a change is archived.


## How it works

```
  ┌──────────────┐    ┌──────────────┐    ┌───────────────────────┐    ┌─────────────────────────┐
  │ 1. lv init   │ →  │ 2. lv start  │ →  │ 3. OpenSpec in your   │ →  │ 4. Merge / archive      │
  │ lv bootstrap │    │  <ticket> or │    │    coding agent       │    │    archive the spec and │
  │              │    │  "<text>"    │    │  /opsx:propose        │    │    refresh the feature  │
  │ feature docs │    │ branch +     │    │  /opsx:apply          │    │    docs (CI, optional)  │
  │ from code    │    │ state.yaml   │    │  (docs auto-loaded)   │    │                         │
  └──────────────┘    └──────────────┘    └───────────────────────┘    └────────────┬────────────┘
         ▲                                                                          │
         └──────────────────── docs stay accurate for the next change ◄─────────────┘
```

1. **Set up once** — `lv init` installs OpenSpec for your coding agent and wires it to LV's docs. `lv bootstrap` writes a feature's docs from the existing code.
2. **Start a change** — `lv start <ticket-id>` pulls the ticket from Lark Base (or `lv start --description "..."` for no ticket), creates a branch, and records context in `state.yaml`.
3. **Plan and build** — run `/opsx:propose`, `/opsx:apply`, ... in your coding agent. Feature docs and ticket context load automatically.
4. **Archive** — `/opsx:archive` also refreshes the docs of affected features. Optionally let [CI do it on merge](docs/guides/ci.md).

## Get started

Requires Node.js >= 20.

```bash
npm install -g lv-engineer-crew

cd /path/to/your-repo
cp .lv.local.yaml.sample .lv.local.yaml   # add credentials; see Configuration
lv init --tool claude                     # or cursor, codex, ... (comma-separated)
lv bootstrap <feature-id> --description "what the feature does"   # docs for an existing feature
lv start <ticket-id>                      # from a Lark ticket
lv start --description "..."              # or from free text, no ticket
```

Then continue in your coding agent with `/opsx:propose`. Coming back later? `lv resume [ticket-id]`.

## Minimal configuration

`.lv.yaml` at the repo root (committed):

```yaml
lark:
  base_id: "YOUR_BASE_ID"
  table_id: "YOUR_TABLE_ID"
  feature_id_field: "Feature ID"
  title_field: "Title"
  # ui_design_field: "UI Design"     # Figma link / prototype / image — captured as a reference
  # attachment_field: "Attachment"   # Lark attachment column — files are downloaded into docs/changes/<change-id>/attachments/
default_branch: main
model: openai/gpt-4o
```

`.lv.local.yaml` (gitignored) holds credentials: `lark_app_id`, `lark_app_secret`, `openai_api_key`. Env vars (`LARK_APP_ID`, ...) take priority. Full options (branch naming, scan paths, sub-ticket fields, ...) are in [Configuration](docs/guides/configuration.md).

## What LV adds to your repo

```
docs/
  features/<feature-id>/{overview.md,design.md}   # living feature docs
  features/INDEX.md
  changes/<change-id>/state.yaml                  # ticket/description context for OpenSpec
openspec/changes/<change-id>/                     # owned by OpenSpec
```

## More docs

- [Configuration](docs/guides/configuration.md) — `.lv.yaml`, credentials, UI design and attachment fields
- [Commands](docs/guides/commands.md) — `lv init`, `bootstrap`, `start`, `resume`, `status`
- [CI workflows](docs/guides/ci.md) — archive & doc sync on merge, npm release
- [Ticket systems](docs/guides/ticket-systems.md) — Lark today, Jira and others welcome

## Contributing

```bash
git clone <repo> && cd lv-engineer-crew
npm install && npm run build
npm link          # global `lv` pointing at your build
npm run mastra    # traces at localhost:4111
```

Stack: TypeScript, [Mastra](https://mastra.ai), LibSQL, `state.yaml` in git as the source of truth.
