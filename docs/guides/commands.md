# Commands

Reference for every `lv` command.

## `lv init [--tool <tool>]`

Install and configure [OpenSpec](https://github.com/Fission-AI/OpenSpec) for a coding agent, wired to LV's context.

```bash
lv init --tool claude,codex   # install/configure OpenSpec for Claude Code and Codex
lv init                 # no --tool — OpenSpec's own interactive prompt runs
```

- Delegates entirely to the OpenSpec CLI (`openspec init --tools <tool>`) — `lv` does not hardcode a list of supported coding agents; whatever `openspec init --help` supports, `--tool` accepts. Refer to [OpenSpec's supported tools](https://github.com/Fission-AI/OpenSpec/blob/main/docs/supported-tools.md)
- Idempotently appends a pointer to OpenSpec's project-wide `context:` (`openspec/config.yaml`) naming `docs/features/<feature-id>/{overview.md,design.md}` and the current change's `docs/changes/<change-id>/state.yaml`, so OpenSpec's explore/propose/apply workflows load them automatically instead of you pasting them into every prompt
- Idempotently patches the generated `/opsx:propose` workflow so, when a change's `state.yaml` has a UI design reference, it analyzes it while writing the proposal (see the UI Design field above) — scoped to `/opsx:propose` only, not every workflow
- Run once per repo (re-running is safe — the OpenSpec install and both patches above are idempotent)

## `lv bootstrap <feature-id> [--paths <paths>] [--name <name>] [--description <description>]`

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

## `lv start <ticket-id> [--type <type>]` / `lv start --description "<text>" [--type <type>]`

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

## `lv resume [ticket-id]`

Check out a change's branch and print its `state.yaml` context — for picking a change back up after a break, or on a different machine.

```bash
lv resume            # uses the current branch
lv resume PROJ-123   # finds and checks out PROJ-123's branch, whatever type it is
```

- Recognizes a branch under any configured type (`feature/PROJ-123-...`, `hotfix/PROJ-123-...`, ...), not just the default
- Given a ticket ID: finds all its branches across every type (local and remote) by ticket ID alone, ignoring the `{summary}` suffix; one match checks it out directly, multiple matches asks you to pick, no matches falls back to the default type's rendered name
- Given no ticket ID and the current branch isn't a change branch: lists every change branch found (any type) and asks which one to resume, instead of just failing
- Prints the resolved change's `state.yaml` summary and a reminder to continue via your coding agent's OpenSpec workflow

## `lv status`

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
