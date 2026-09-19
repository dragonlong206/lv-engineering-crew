## Context

`lv init` (`src/cli/init.ts`) already patches several generated OpenSpec workflow files in place, opportunistically and idempotently, using an anchor-text-and-insert (or replace) strategy — see `addProposeStateAutoload()`, `addProposeUiDesignInstruction()`, `addProposeAttachmentInstruction()`, `addProposeLinkInstruction()`. Each targets `PROPOSE_WORKFLOW_FILES`, a fixed list of every known location `openspec init`/`openspec update` generates a `/opsx:propose` file at across tools this repo supports, skipping any that don't exist. `runInit()` currently never calls `loadConfig()` — it only resolves `getRepoRoot()` — because none of its existing patches read `.lv.yaml`; `output_language` is instead surfaced by having the generated OpenSpec workflow itself check `.lv.yaml` at run time (see `openspec/specs/lv-init/output-language/spec.md`), not by `lv init` embedding the value.

This change is different: a per-command **model** pin is a property of the *file itself* (Claude Code reads a `model:` frontmatter key to decide which model executes that slash command), not something the running agent can act on by reading instructional text mid-workflow the way `output_language` is. So `lv init` has to embed the configured value into the generated file's frontmatter at patch time, which means `runInit()` needs the resolved config for the first time.

Frontmatter model pinning is a Claude Code-specific mechanism. Of the two known command shapes `lv` already authors for (`LV_BOOTSTRAP_KNOWN_COMMAND_SHAPES`: `.claude`, `.cursor`), only Claude Code's slash-command format is documented to support it — Cursor's command format and every SKILL.md-based agent shape (`.claude/skills/openspec-apply-change/SKILL.md`, `.agents/skills/openspec-apply-change/SKILL.md`) have no equivalent. Unlike the `/opsx:propose` patches (plain body text insertions that work identically whether the file is a slash command or a skill), this patch is meaningful only for `.claude/commands/opsx/apply.md`.

## Goals / Non-Goals

**Goals:**
- Let an engineer configure a Claude Code model alias/id once in `.lv.yaml` and have it actually pin `/opsx:apply`'s executing model, surviving `lv init` re-runs after `openspec update`/`openspec init --force` regenerates the file.
- Keep the setting idempotent to apply, update, and clear, matching the existing patch functions' behavior contract.

**Non-Goals:**
- Pinning a model for any other OpenSpec workflow (`propose`, `explore`, `sync`, `archive`) — the ticket is scoped to apply only; nothing here prevents extending the same mechanism later.
- Supporting per-command model pinning for coding-agent shapes with no such frontmatter mechanism (Cursor, Codex, any SKILL.md-based shape). Those are silently left untouched, the same way `LV_BOOTSTRAP_KNOWN_COMMAND_SHAPES` silently skips a command file for tools it has no template for.
- Changing `models:`/`getModelForStep()` or anything about LV's own Mastra agents (`featureMatchAgent`/`featureSplitAgent`) — those select a Mastra `"provider/model"` string for LV's own LLM calls and are unrelated to which model a coding agent's slash command runs on.

## Decisions

**1. New `openspec.apply_model` config key, not a new field on `models:`.**
`models:` (`ModelsConfigSchema`) holds Mastra `"provider/model"` strings consumed by `getModelForStep()` for LV's own throwaway agents. `apply_model` holds a Claude Code model alias/id (e.g. `"haiku"`, or a full model id) consumed by an entirely different runtime (the coding agent executing a slash command) with a different value format and no relation to Mastra. Reusing `models:` would suggest a shared format/mechanism that doesn't exist. A new top-level `OpenSpecConfigSchema` (`{ apply_model?: string }`) mirrors the existing `LarkConfigSchema`/`TracingConfigSchema` pattern and leaves room for a future analogous setting (e.g. a propose-model override) without another top-level key.

**2. Patch only `.claude/commands/opsx/apply.md`, not a `PROPOSE_WORKFLOW_FILES`-style list.**
Considered mirroring `PROPOSE_WORKFLOW_FILES`'s multi-location list (command file + both SKILL.md shapes). Rejected: a `model:` frontmatter key on a SKILL.md file has no defined effect in either Claude Code's or Codex's skill runtime, so patching it would silently do nothing while looking wired up. Limiting to the one file location that's actually documented to honor it keeps the feature honest about what it does, at the cost of only covering Claude Code today — consistent with how `LV_BOOTSTRAP_KNOWN_COMMAND_SHAPES` already scopes command-file authoring to the tools `lv` has a concrete template for.

**3. `runInit()` loads config once, right before the existing patch calls.**
`loadConfig()` (`src/config.ts`) already merges `.lv.yaml`/`.lv.local.yaml`/env vars and validates via `ConfigSchema` — reusing it avoids a second config-loading path. It's called once in `runInit()`, after the `openspec init` shell-out succeeds (same point the other patches already run from), and the resolved `Config` is threaded into the new patch function only; none of the other patch functions need it.

**4. Set-or-clear semantics, driven entirely by presence/absence of `apply_model` on each `lv init` run.**
Unlike the `/opsx:propose` patches (which only ever add or upgrade wording, never remove it), this patch also removes a previously-added `model:` field when `apply_model` is unset at patch time — because a stale pin left behind after an engineer intentionally unconfigures it would silently keep charging the pinned model with no `.lv.yaml` evidence of why. The patch function is the single idempotent operation for all three cases (add, update, remove), keyed off whether `config.openspec?.apply_model` is a non-empty string.

**5. Frontmatter edit strategy: parse the leading `---`-delimited block, edit the `model` key, re-serialize only that block.**
Every generated `.claude/commands/opsx/*.md` file starts with a YAML frontmatter block (`name`, `description`, `allowed-tools`, `category`, `tags`) delimited by `---` lines, followed by the markdown body untouched. The patch:
- Requires the file to start with `---\n`; if it doesn't, logs the same "file may have changed shape upstream" warning style as the existing patches and skips.
- Locates the closing `---` line.
- Parses the frontmatter text with `js-yaml` (already a dependency, used elsewhere in `init.ts` for `openspec/config.yaml`) into an object, sets or deletes `model`, and re-dumps only that block with `yaml.dump()`, leaving the markdown body byte-for-byte untouched.
- This is a full parse-and-redump of the frontmatter (unlike the raw-text-preserving append `addContextPointer()` uses for `openspec/config.yaml`) because the frontmatter here is a short, fully-generated block with no hand-authored comments worth preserving — the risk `addContextPointer()`'s raw-append avoids doesn't apply.

Alternative considered: an anchor-regex insert/replace of a `model: <value>` line, matching the other patch functions' style exactly. Rejected because getting insertion position, indentation, and quoting right by regex against a YAML block is more fragile than parsing it — the existing anchor-regex patches all target markdown body text, not YAML, where structural parsing wasn't already the natural tool.

## Risks / Trade-offs

- **[Risk]** `openspec update`/`openspec init --force` wipes this patch along with the propose patches. → Same mitigation already documented for those: `lv init`'s own doc/spec instructs re-running it afterward; no new behavior needed.
- **[Risk]** Claude Code's `model:` frontmatter field accepts specific alias/id strings; an engineer could put an invalid value in `apply_model` and only discover it when `/opsx:apply` fails or falls back unexpectedly. → Out of scope to validate against Claude Code's live model list from `lv`; `ConfigSchema` only checks it's a string, matching how `models:` and `output_language` are similarly unvalidated free-form strings today.
- **[Risk]** Only Claude Code is covered; an engineer using Cursor/Codex gets no error and no effect. → Acceptable per Non-Goals; if the file doesn't exist the patch is a no-op, same as every other tool-specific patch in `init.ts`.
