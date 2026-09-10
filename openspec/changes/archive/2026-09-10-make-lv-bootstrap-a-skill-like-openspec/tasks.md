## 1. CLI: replace LLM-driven bootstrap modes with `--context`/`--finalize`

- [x] 1.1 Add `--context` to `lv bootstrap <feature-id>` (`src/cli/bootstrap.ts`): load config, create the feature directory, read any existing `overview.md`/`design.md`, and — when `--paths` is also given — expand paths into a capped file list via the existing `listCodeFiles()` logic from `runBootstrapFromPaths()`. Print the JSON shape from design.md Decision 1 (`repoRoot`, `overviewPath`, `designPath`, `scanExtensions`, `scanSkipDirs`, `outputLanguage`, `existingOverviewMarkdown?`, `existingDesignMarkdown?`, `paths?`, `name?`, `description?`) and nothing else to stdout. Verify with `npm run dev -- bootstrap <existing-feature-id> --context` against this repo (dogfooding) and confirm the printed JSON parses and reflects real file state.
- [x] 1.2 Add `--finalize --title <title>` to `lv bootstrap <feature-id>`: call the existing `updateIndex()` and `syncNewFeatureToLark()` against the feature ID, assuming `overview.md`/`design.md` already exist. Verify by manually writing placeholder content into a scratch feature's docs, running `--finalize`, and confirming `docs/features/INDEX.md` gains the expected entry.
- [x] 1.3 Change the no-flag `lv bootstrap <feature-id>` invocation (no `--new-feature`, `--context`, or `--finalize`) to exit with an error message pointing at the `lv-bootstrap` Claude Code skill/command instead of attempting any LLM call. Verify by running `npm run dev -- bootstrap some-id` with no flags and confirming a clear, non-zero-exit error naming the replacement.
- [x] 1.4 Confirm `--new-feature` placeholder mode is untouched by 1.1-1.3 (no shared code path was altered). Verify with `npm run dev -- bootstrap scratch-feature --new-feature` and diff its output against pre-change behavior.

## 2. Remove the Mastra-agent bootstrap machinery

- [x] 2.1 Delete `src/agents/bootstrap-agent.ts` and its `createBootstrapScanAgent()` export.
- [x] 2.2 Remove `bootstrapAgent`, `runBootstrapFromPaths`, `runBootstrapFromScan`, `generateFeatureDocsFromScan`, and `ScanJsonFailureError` from `src/cli/bootstrap.ts`, keeping `generateFeatureDocsPlaceholder`, `updateIndex`, and `syncNewFeatureToLark` intact for `lv start` and the new `--finalize` flag.
- [x] 2.3 Remove `buildCodebaseTools()` and its Mastra `Tool` wrappers from `src/tools/codebase.ts`, keeping `listCodeFiles()` and the `DEFAULT_CODE_EXTENSIONS`/`DEFAULT_SKIP_DIRS` constants for `--context`'s path expansion.
- [x] 2.4 Remove `BOOTSTRAP_AGENT_INSTRUCTIONS`, `BOOTSTRAP_SCAN_JSON_RETRY_NUDGE`, `buildBootstrapScanPrompt`, `buildBootstrapOverviewPrompt`, `buildBootstrapDesignPrompt`, and (per design.md Decision 5's correction) the now-dead `buildOutputLanguageParagraph()` from `src/prompts.ts`, keeping `AUTO_GENERATED_HEADER`. Also keep `getModelForStep()` (`src/config.ts`) — `bootstrap.ts` stops calling it, but `src/cli/start.ts`'s feature-match/split agents still do (design.md Decision 6 correction). Verified 2.1-2.4 together with `npx tsc --noEmit` reporting no errors.

## 3. Author the skill content, plus command content for known shapes

- [x] 3.1 Add a new `LV_BOOTSTRAP_SKILL_BODY` constant to `src/prompts.ts` per design.md Decision 4: instructs calling `lv bootstrap <feature-id> --context ...` first, exploring per its `paths` field (or freely if absent) using the calling agent's own tools, applying the "refine, don't blindly copy" guidance carried over from the old `BOOTSTRAP_AGENT_INSTRUCTIONS`, writing `overview.md`/`design.md` with the literal auto-generated header text prepended, honoring `outputLanguage` from the context JSON, and finishing with `lv bootstrap <feature-id> --finalize --title "<derived-title>"`. This one constant is shared verbatim by every tool's `SKILL.md` and command file.
- [x] 3.2 Write the shared `SKILL.md` frontmatter template (`name: lv-bootstrap`, `allowed-tools: Bash(lv bootstrap:*)`, `metadata.author: lv`) that renders identically for every tool with `LV_BOOTSTRAP_SKILL_BODY` — this template is tool-agnostic, so it takes no tool-specific branching.
- [x] 3.3 Write Claude's command frontmatter template (`name: "LV: Bootstrap"`, same `allowed-tools`) for `.claude/commands/lv/bootstrap.md`.
- [x] 3.4 Write Cursor's command frontmatter template (`name: "/lv-bootstrap"`, `id: "lv-bootstrap"`, `category: "Workflow"`, no `allowed-tools`) for `.cursor/commands/lv-bootstrap.md`.
- [x] 3.5 Define the "known command shapes" table referenced by design.md Decision 3/4 as a small, explicit map (currently `{ claude: <3.3's template>, cursor: <3.4's template> }`) that Section 4's installer consults — structured so adding a future tool's shape (e.g. Gemini's `.toml`) means adding one entry, not touching the detection logic.
- [x] 3.6 Verify 3.1-3.5 by rendering the skill for at least two tools and the command for both known shapes (via 4.1 below), reading them end-to-end for internal consistency: every `lv bootstrap` invocation the body describes matches a flag that actually exists per Section 1.

## 4. Wire `lv init` to install the skill dynamically, and the command for known shapes

- [x] 4.1 Add `installLvBootstrapSkill(repoRoot)` to `src/cli/init.ts` (per design.md Decision 3's correction: checks each of `repoRoot`'s own immediate subdirectories for `skills/openspec-propose/SKILL.md` rather than a full recursive glob, since OpenSpec always writes tool dirs at the repo root) and idempotently writes `<tool-base-dir>/skills/lv-bootstrap/SKILL.md` from the Section 3 skill template for each match — with no hardcoded tool names in this step.
- [x] 4.2 For each `<tool-base-dir>` found in 4.1, check it against the known-command-shapes table from 3.5 and, on a match, idempotently write that tool's command file too.
- [x] 4.3 Call `installLvBootstrapSkill(repoRoot)` from `runInit()` alongside the existing `addContextPointer`/`addArchiveGuidance`/`addProposeStateAutoload` calls.
- [x] 4.4 Verify end to end for Claude: run `lv init --tool claude` (or `npm run dev -- init --tool claude`) against a scratch repo, confirm the skill and command files are created with expected content, then re-run and confirm no duplicates (idempotency).
- [x] 4.5 Verify end to end for Codex: run `lv init --tool codex` against a scratch repo, confirm only `.agents/skills/lv-bootstrap/SKILL.md` is created (no command file, since Codex has no known command shape).
- [x] 4.6 Verify end to end for Cursor: run `lv init --tool cursor` against a scratch repo, confirm `.cursor/skills/lv-bootstrap/SKILL.md` and `.cursor/commands/lv-bootstrap.md` are both created.
- [x] 4.7 Verify the dynamic-detection claim directly: run `lv init --tool gemini` (a tool with no `lv` code referencing it by name) against a scratch repo and confirm `.gemini/skills/lv-bootstrap/SKILL.md` is still created, with no command file (no known shape for Gemini yet).
- [x] 4.8 Verify multi-tool selection: run `lv init --tool "claude,cursor,gemini"` against a scratch repo and confirm all three tools' skill files are created in the same run, with command files only for claude and cursor.
- [x] 4.9 Verify the negative case: run `lv init` for a tool OpenSpec itself doesn't support (an invalid `--tool` value) and confirm `openspec init` itself reports the error, with no partial `lv-bootstrap` files left behind.

## 5. Manual end-to-end verification

- [x] 5.1 In this repo (dogfooding), run the `lv-bootstrap` skill/command from Claude Code against an existing feature ID (e.g. `lv-bootstrap` itself) with no explicit paths, and confirm it explores the repo, writes `overview.md`/`design.md` with the auto-generated header, and successfully calls `--context`/`--finalize` without error.
- [x] 5.2 Run the skill/command again with explicit `--paths` pointed at a narrow file set and confirm it reads only those paths rather than exploring freely.
- [x] 5.3 Repeat 5.1 (no-paths run) from at least one other tool with a known command shape (Cursor) against a scratch repo, and confirm the generated docs follow the same conventions (header, index update) as the Claude run.
- [x] 5.4 Run `npm run build` and `npx tsc --noEmit` and confirm both succeed with the Mastra-agent bootstrap code removed.

## 6. Documentation refresh

- [x] 6.1 Run the `lv-bootstrap` skill/command against `docs/features/lv-bootstrap/` and `docs/features/lv-init/` to refresh their docs to reflect this change, per design.md's Migration Plan.
- [x] 6.2 Update CLAUDE.md's "Agents" section to describe the skill-based bootstrap flow in place of `createBootstrapScanAgent()`/the inline `bootstrapAgent`, explaining (a) the dynamic, glob-based skill detection that covers every coding agent OpenSpec installs, matching the OpenSpec-delegation philosophy CLAUDE.md already documents, and (b) the small, explicit known-command-shapes table (Claude Code, Cursor today) that decides which agents also get a slash command, and update the "Command wiring"/"Prompts" sections if their descriptions of `src/prompts.ts` or `src/cli/bootstrap.ts` are now stale.
