<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv init

## Architecture and layers

`lv init` is a thin orchestration layer around five responsibilities:

1. delegate installation to the external `openspec` CLI
2. post-process `openspec/config.yaml` to inject LV-specific guidance
3. patch generated OpenSpec workflow files so they cooperate with LV change tracking
4. install the `lv-bootstrap` skill (and, for known coding-agent shapes, a slash command) into every coding agent OpenSpec was just installed for
5. pin the generated Claude Code `/opsx:apply` command's `model` frontmatter field from `.lv.yaml`, when configured

The CLI entry point lives in `src/index.ts`, which dispatches to `runInit()` in `src/cli/init.ts`. Shared instruction text lives in `src/prompts.ts`, keeping the command implementation focused on file I/O and orchestration.

The config update logic uses two modes:

- raw append for fresh templates, so OpenSpec scaffold comments survive
- YAML parse and rewrite for already-active keys, so existing user customization can be merged structurally

The apply-model pin step (`setApplyModelOverride()`) uses a third mode: a full parse-and-redump of a target file's leading YAML frontmatter block only, leaving the markdown body untouched. This differs from the `/opsx:propose` patches' anchor-regex text inserts because the file being edited is itself a short, fully-generated YAML block with no comments worth preserving, and because a per-command model pin is a frontmatter key on a specific known file (`.claude/commands/opsx/apply.md`), not markdown body text that also appears identically in every SKILL.md shape.

The `lv-bootstrap` skill/command install step is dynamic rather than tied to the `--tool` flag: it detects which coding agents were actually installed by scanning the repo, not by parsing `--tool`'s string (which is `undefined` whenever an engineer lets OpenSpec's own interactive picker decide). The apply-model pin step, in contrast, targets one fixed, known file location rather than scanning for installed tools, because only Claude Code's generated command-file format is documented to honor a `model` frontmatter override.

`runInit()` calls `loadConfig()` (from `src/config.ts`) once, right before the apply-model pin step — the only one of `lv init`'s patch steps that needs `.lv.yaml`'s resolved config; every other patch step operates purely on `repoRoot` and static instruction text.

## Data model / schema

The feature operates on OpenSpec's repository-local config file, `openspec/config.yaml`, and on `.lv.yaml`'s new `openspec.apply_model` setting.

It writes or updates these parts of `openspec/config.yaml`:

- `context:` receives a multiline string containing:
  - a reminder to read `docs/features/<feature-id>/{overview.md,design.md}` for touched features
  - a pointer to `docs/changes/<change-id>/state.yaml` for the current change
  - a convention, not an enforced check, to invoke the `lv-bootstrap` skill/command for each touched feature ID when syncing specs directly with `/opsx:sync`
  - a reminder to honor `.lv.yaml`'s `output_language` setting when generating prose
- `operations.archive.guidance:` receives one list item instructing archive workflows to refresh the docs of every touched feature before completing, by invoking the `lv-bootstrap` skill/command for each feature ID (not a bare `lv bootstrap <feature-id>` call, which errors under the current CLI once it requires an explicit mode flag)

The command also patches generated `/opsx:propose` workflow files in these locations when they exist:

- `.claude/commands/opsx/propose.md`
- `.claude/skills/openspec-propose/SKILL.md`
- `.agents/skills/openspec-propose/SKILL.md`

Those workflow patches insert LV-specific instructions around existing OpenSpec steps:

- a line that autoloads `docs/changes/<change-id>/state.yaml` when the current git branch matches
- a line that records the newly created OpenSpec change with `lv link "<name>"`
- a line that checks `state.yaml` for a `ui_design` reference and, when writing `proposal`, attempts to inspect it and reflect that in proposal text
- a line that checks `state.yaml` for downloaded `attachments` and, when writing `proposal`, reads them directly and reflects that in proposal text

Separately, `installLvBootstrapSkill()` writes:

- `<tool-base-dir>/skills/lv-bootstrap/SKILL.md` for every coding agent detected — identical content across every agent (frontmatter: `name: lv-bootstrap`, `allowed-tools: Bash(lv bootstrap:*)`, `metadata.author: lv`)
- `.claude/commands/lv/bootstrap.md` and `.cursor/commands/lv-bootstrap.md` when that specific agent is detected — the two "known command shapes" `lv` currently has templates for

`setApplyModelOverride()` patches one fixed file, `.claude/commands/opsx/apply.md`, when it exists:

- if `.lv.yaml`'s `openspec.apply_model` is a non-empty string, the file's frontmatter `model` field is set (added or overwritten) to that value
- if `openspec.apply_model` is unset (or `null`, e.g. from a fully commented-out `openspec:` block), a previously-added `model` field is removed instead
- either way, only the frontmatter block (between the leading `---` lines) is rewritten; the markdown body is untouched

`ConfigSchema` (`src/types.ts`) gained an `openspec: OpenSpecConfigSchema.nullish()` field, `OpenSpecConfigSchema` being `{ apply_model?: string }`. It uses `.nullish()`, not `.optional()`, because `.lv.yaml`'s `openspec:` key parses as `null` (not simply absent) when every child under it is commented out, which is how the setting is documented in the shipped template.

## APIs / interfaces

### CLI

- `lv init`
- `lv init --tool <tool>`

`--tool` is forwarded to `openspec init --tools <tool>`. If omitted, OpenSpec is launched without a tools argument.

### Internal functions and constants

- `runInit(opts: { tool?: string })` in `src/cli/init.ts`
- `isOpenSpecInstalled(): boolean` in `src/cli/init.ts`, which uses `which.sync("openspec", { nothrow: true })`
- `addContextPointer(repoRoot: string)` in `src/cli/init.ts`
- `addArchiveGuidance(repoRoot: string)` in `src/cli/init.ts`
- `addProposeStateAutoload(repoRoot: string)` in `src/cli/init.ts`
- `addProposeUiDesignInstruction(repoRoot: string)` in `src/cli/init.ts`
- `addProposeAttachmentInstruction(repoRoot: string)` in `src/cli/init.ts`
- `addProposeLinkInstruction(repoRoot: string)` in `src/cli/init.ts`
- `installLvBootstrapSkill(repoRoot: string)` in `src/cli/init.ts`, using `findOpenSpecToolBaseDirs(repoRoot: string)` for detection and the `LV_BOOTSTRAP_KNOWN_COMMAND_SHAPES` map for the command-file step
- `setApplyModelOverride(repoRoot: string, config: Config)` in `src/cli/init.ts`, using the `APPLY_COMMAND_RELATIVE_PATH` constant (`.claude/commands/opsx/apply.md`) and the `FRONTMATTER_RE` regex to locate the leading `---`-delimited block
- `CONTEXT_POINTER_LINES`, `LEGACY_CONTEXT_POINTER_SYNC_LINE`, `ARCHIVE_GUIDANCE`, `LEGACY_ARCHIVE_GUIDANCE`, `PROPOSE_STATE_AUTOLOAD_LINE`, `PROPOSE_LINK_CHANGE_LINE`, `PROPOSE_UI_DESIGN_LINE`, `PROPOSE_ATTACHMENT_LINE`, `buildLvBootstrapSkillFile()`, `buildLvBootstrapClaudeCommandFile()`, and `buildLvBootstrapCursorCommandFile()` in `src/prompts.ts` — the `LEGACY_*` constants hold each guidance's wording from before `lv bootstrap` became a skill/command, kept only so the patching functions below can detect and upgrade an already-installed copy
- `flexibleWhitespacePattern(text: string): RegExp` in `src/cli/init.ts`, used by `addContextPointer()` to locate `LEGACY_CONTEXT_POINTER_SYNC_LINE` inside the YAML-reflowed `context:` string regardless of how it was line-wrapped
- `OpenSpecConfigSchema`/`OpenSpecConfig` in `src/types.ts`, and `loadConfig()` in `src/config.ts`, used by `setApplyModelOverride()` to read `openspec.apply_model`

## Key design decisions

- OpenSpec is treated as the external integration layer, so LV delegates tool support to `openspec init` instead of maintaining its own agent matrix for OpenSpec's own workflows.
- Installation detection is path-based and synchronous. This avoids relying on platform-specific spawn error shapes.
- The command captures `openspec init` stderr while still streaming output live to the terminal, so failures can include useful diagnostics.
- `openspec/config.yaml` is updated with whitespace-normalized idempotency checks, so rerunning `lv init` does not duplicate guidance even if formatting changes.
- Fresh templates are patched by appending YAML, preserving generated comments. When a section is already active, the code falls back to YAML parsing and rewriting so missing nested keys can be merged structurally.
- Both `addArchiveGuidance()` and `addContextPointer()` also upgrade a previously-installed copy of their guidance in place when it still carries an earlier wording (`LEGACY_ARCHIVE_GUIDANCE`/`LEGACY_CONTEXT_POINTER_SYNC_LINE`), instead of leaving the outdated wording in place or appending the current wording as a second, duplicate entry — mirroring the existing `LEGACY_PROPOSE_STATE_AUTOLOAD_LINE` → replace pattern `addProposeStateAutoload()` already uses for its own prior wording change. `addArchiveGuidance()` matches the legacy entry within the parsed `operations.archive.guidance` array by normalized content; `addContextPointer()` matches it within the parsed `context:` string with a whitespace-flexible regex (`flexibleWhitespacePattern()`), since that string's line wrapping/joins differ across `lv init` runs (single-newline joins in one run, blank-line-separated joins from another) and a fixed paragraph-boundary split cannot be relied on to isolate the entry.
- The archive guidance is advisory only. It is read by OpenSpec's generated archive workflow and does not block completion if ignored.
- The `/opsx:propose` workflow patches are best-effort and shape-dependent. They are not driven by `openspec/config.yaml`; they are inserted directly into generated workflow files because those steps need to run before OpenSpec's context instructions are surfaced.
- The UI-design and attachment instructions are scoped to `/opsx:propose` only, because they are only useful when writing the proposal artifact.
- `lv init` is not a full OpenSpec file generator. It leaves OpenSpec's own generated workflows in place and only adds LV-specific context and workflow adjustments.
- Unlike OpenSpec's own tool support, the `lv-bootstrap` skill/command install step is `lv`'s own content, not delegated to `openspec`. It detects target coding agents dynamically (by what OpenSpec actually installed, not a maintained list), but keeps the command-file step scoped to a small, explicit "known shapes" table, since a command file's format varies too much across tools to generalize the way the skill file does.
- `apply_model` lives under a new `openspec:` top-level key in `.lv.yaml`, not on the existing `models:` map, because `models:` holds Mastra `"provider/model"` strings for LV's own throwaway agents (`getModelForStep()`), a different runtime and value format from a Claude Code slash-command model alias.
- `setApplyModelOverride()` only ever touches `.claude/commands/opsx/apply.md`. It does not extend the `/opsx:propose`-style multi-location patch list to also cover `.claude/skills/openspec-apply-change/SKILL.md` or `.agents/skills/openspec-apply-change/SKILL.md`, because neither Claude Code's nor Codex's skill runtime honors a `model` frontmatter key on a SKILL.md file — patching those would look wired up while doing nothing.
- The apply-model pin is set-or-clear, not add-only. Unlike the `/opsx:propose` patches (which only ever add or upgrade wording), `setApplyModelOverride()` also deletes a previously-added `model` field when `openspec.apply_model` is absent at patch time, so an engineer who unconfigures the setting doesn't end up with a stale pin and no `.lv.yaml` evidence of it.
- `ConfigSchema.openspec` uses `.nullish()` rather than `.optional()` so a `.lv.yaml` with the `openspec:` key present but every child commented out (`openspec:` followed only by comment lines, which `js-yaml` parses as `openspec: null`) still validates; `config.openspec?.apply_model` reads `undefined` in that case via optional chaining, same as when the key is absent entirely.

## Runtime behavior of the pin (verified against Claude Code's own docs)

- The `model:` frontmatter override is scoped to a single turn, not the session. Per Claude Code's docs (code.claude.com/docs/en/commands, code.claude.com/docs/en/skills), it "applies for the rest of the current turn" and "isn't saved to settings" — the session's prior model (whatever `/model` had set, or the default) automatically resumes on the next prompt. So running `/opsx:propose` on one model and then `/opsx:apply` (pinned via this feature) runs only the apply turn on the pinned model; a subsequent `/opsx:archive` reverts to whatever the session was on before.
- The override does cover the whole turn, including every internal tool-calling round-trip within it (e.g. `/opsx:apply`'s task-by-task implementation loop) — it only clears when the next user prompt is sent, not between tool calls in the same turn.
- Undocumented edge case: whether the pin propagates into a Task/Agent-tool subagent spawned during that turn is not addressed in Claude Code's docs outside the separate `context: fork` mechanism (where `model:` instead sets the forked subagent's model). `lv`'s generated `/opsx:apply` command doesn't use `context: fork`, so this doesn't apply to it, but it's a gap in upstream documentation worth knowing about if `apply`'s generated workflow ever changes to fork.
- If the configured model is excluded by an org's `availableModels` allowlist, Claude Code keeps the session's current model instead of erroring — `lv` has no visibility into or control over that fallback.

## Risks / trade-offs carried into the code

- `openspec update`/`openspec init --force` regenerates `.claude/commands/opsx/apply.md` from scratch, wiping the pin along with the `/opsx:propose` patches; re-running `lv init` re-applies it (same mitigation as the existing patches, no new behavior).
- Claude Code's `model` frontmatter field is not validated against Claude Code's live model list; an invalid `openspec.apply_model` value is only discovered when `/opsx:apply` runs, matching how `models:` and `output_language` are similarly unvalidated free-form strings.
- Only Claude Code is covered, and this is a hard ceiling, not just an unimplemented extension. Cursor's command format has no confirmed equivalent, and Codex CLI (confirmed against its own docs at developers.openai.com/codex/skills and .../config-advanced) has no per-invocation model-pinning mechanism at all: its `SKILL.md` frontmatter only recognizes `name`/`description`, and model selection (`--model`/`-m`, `config.toml`, `--profile`, `/model`) is session/CLI-invocation-wide only. An engineer on Cursor or Codex sees no error and no effect, since the target file won't exist in their repo and the patch step is a no-op when it's missing — there's no equivalent file or field `lv` could target for those tools even if it tried.
