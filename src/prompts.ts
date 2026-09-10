import type { ExistingFeature } from "./engine/feature-id.js";

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export const AUTO_GENERATED_HEADER = `<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

`;

// ---------------------------------------------------------------------------
// Bootstrap — new-feature placeholder mode (no scan, no LLM call)
// ---------------------------------------------------------------------------

export function buildBootstrapPlaceholderOverview(featureId: string): string {
  return `# ${featureId}

## Purpose of the Feature

<!-- TODO: describe what this feature does and why it exists -->

## Main Components

<!-- TODO: list the main components -->

## High-level Flow

<!-- TODO: describe the high-level flow -->

## Constraints and Assumptions

<!-- TODO: list constraints and assumptions -->

## Current State of the Code

<!-- TODO: describe the current state of the code -->
`;
}

export function buildBootstrapPlaceholderDesign(featureId: string): string {
  return `# ${featureId}

## Architecture and Layers

<!-- TODO: describe architecture and layers -->

## Data Model / Schema

<!-- TODO: describe data model / schema -->

## APIs / Interfaces

<!-- TODO: describe APIs / interfaces -->

## Key Design Decisions

<!-- TODO: list key design decisions -->
`;
}

// ---------------------------------------------------------------------------
// Bootstrap — lv-bootstrap skill/command body (shared across every coding agent
// it is installed for; see openspec/changes/make-lv-bootstrap-a-skill-like-openspec)
// ---------------------------------------------------------------------------

// The literal auto-generated header text, inlined here (rather than imported) so the skill body
// stays a single self-contained constant an engineer can read start to finish without chasing
// another export — `AUTO_GENERATED_HEADER` itself stays the source of truth for placeholder mode.
const LV_BOOTSTRAP_SKILL_HEADER_LITERAL = AUTO_GENERATED_HEADER.trim();

export const LV_BOOTSTRAP_SKILL_BODY = `Generate or refine a feature's \`overview.md\`/\`design.md\` by exploring this repository's actual code — grounded in what you read yourself, not a separate LLM call.

## 1. Get context

Run (no LLM call, just prints JSON):

\`\`\`bash
lv bootstrap <feature-id> --context [--paths <comma-separated-paths>] [--name <hint>] [--description <hint>]
\`\`\`

This prints one JSON object with: \`repoRoot\`, \`overviewPath\`, \`designPath\`, \`scanExtensions\`, \`scanSkipDirs\`, \`outputLanguage\` (omitted when unset), \`existingOverviewMarkdown\`/\`existingDesignMarkdown\` (omitted when no draft exists yet), \`paths\` (only present when \`--paths\` was given — already expanded from any directory into a capped file list), and \`name\`/\`description\` (only present when given as hints). It also creates the feature directory so you can write into it right away. This command never reads file *contents* for you — only resolves *which* files are relevant when \`--paths\` narrows the scope.

## 2. Explore

- If \`paths\` is present in the context JSON: read only those files with your own tools. Do not explore the rest of the repository.
- If \`paths\` is absent: explore the repository yourself (list/glob/grep/read) to find the code relevant to \`<feature-id>\`. Use \`name\`/\`description\`, if present, as a starting hypothesis for where to look, not as text to copy into the output. If the feature is a CLI command, tool, or public API, search for where it's registered/exposed so you capture its current full set of flags/parameters, not just what one implementation file suggests.
- Be economical: narrow down to the handful of files that actually matter, then read only those.

## 3. Refine an existing draft, don't just restate it

If \`existingOverviewMarkdown\`/\`existingDesignMarkdown\` is present, treat it as a draft to verify and refine — not to copy forward with light rewording. Keep sections whose claims you've verified are still true (e.g. purpose/scope/constraints that aren't about code), and rewrite any section whose factual claims are about the code (function signatures, CLI flags/options, file names, module names, architecture) purely from what you observe in this run's own exploration. Never trust the draft for a code fact — verify it, and if you didn't check it, don't assert it. A draft that's gone stale (renamed functions, new options, new files) is the normal case, not the exception.

## 4. Write the docs

Write \`overviewPath\` and \`designPath\` (from the context JSON) directly with your own file-writing tool. Prepend this exact header to both files, followed by a blank line, before the content:

\`\`\`
${LV_BOOTSTRAP_SKILL_HEADER_LITERAL}
\`\`\`

\`overview.md\` must cover: Purpose of the feature, Main components, High-level flow, Constraints and assumptions, Current state of the code.
\`design.md\` must cover: Architecture and layers, Data model / schema, APIs / interfaces, Key design decisions.

Be concise. Do not use em-dashes for parenthetical remarks. If \`outputLanguage\` is present in the context JSON, write all descriptive prose in that language — leave code blocks, identifiers, file paths, and command names untranslated; headings may stay in English.

## 5. Finalize

Once both files are written, run (no LLM call):

\`\`\`bash
lv bootstrap <feature-id> --finalize --title "<short human-readable title derived from the overview you just wrote>"
\`\`\`

This updates \`docs/features/INDEX.md\` and syncs the feature to Lark when that's configured — you don't need to do either yourself.`;

// Shared one-line description used by every tool's SKILL.md/command frontmatter — a single
// constant so the wording never drifts between the skill and any known-shape command file.
const LV_BOOTSTRAP_SKILL_DESCRIPTION =
  "Generate or refine a feature's overview.md/design.md by exploring the repo directly, without a separate LLM call. Use when creating or refreshing docs/features/<feature-id>/{overview.md,design.md}.";

/**
 * Renders the full `SKILL.md` content installed for every coding agent `lv init` detects
 * (see `installLvBootstrapSkill()` in `src/cli/init.ts`) — frontmatter is identical across every
 * tool (only the file's location differs), matching how OpenSpec's own `SKILL.md` body/frontmatter
 * shape is universal across tools.
 */
export function buildLvBootstrapSkillFile(): string {
  return `---
name: lv-bootstrap
description: ${LV_BOOTSTRAP_SKILL_DESCRIPTION}
allowed-tools: Bash(lv bootstrap:*)
metadata:
  author: lv
---

${LV_BOOTSTRAP_SKILL_BODY}
`;
}

/**
 * Renders \`.claude/commands/lv/bootstrap.md\`, invoked as \`/lv:bootstrap <feature-id>\` — one of
 * the "known command shapes" \`installLvBootstrapSkill()\` writes in addition to the universal
 * skill file, mirroring the frontmatter shape OpenSpec itself generates for Claude's own commands.
 */
export function buildLvBootstrapClaudeCommandFile(): string {
  return `---
name: "LV: Bootstrap"
description: "${LV_BOOTSTRAP_SKILL_DESCRIPTION}"
allowed-tools: Bash(lv bootstrap:*)
---

${LV_BOOTSTRAP_SKILL_BODY}
`;
}

/**
 * Renders \`.cursor/commands/lv-bootstrap.md\`, invoked as \`/lv-bootstrap <feature-id>\` — the
 * other "known command shape", mirroring Cursor's own command frontmatter shape (no
 * \`allowed-tools\` field, unlike its \`SKILL.md\`).
 */
export function buildLvBootstrapCursorCommandFile(): string {
  return `---
name: "/lv-bootstrap"
id: "lv-bootstrap"
category: "Workflow"
description: "${LV_BOOTSTRAP_SKILL_DESCRIPTION}"
---

${LV_BOOTSTRAP_SKILL_BODY}
`;
}

// ---------------------------------------------------------------------------
// Start — match an existing feature before allocating a new one
// ---------------------------------------------------------------------------

export function buildFeatureMatchPrompt(
  title: string,
  description: string,
  candidates: ExistingFeature[],
): string {
  const candidateBlocks = candidates
    .map((c) => `### ${c.id}\n${c.overview}`)
    .join("\n\n");

  return `You are matching a new change against a project's existing features, to see if the change is really more work on one of them rather than something new.

## Change

Title: ${title}
Description: ${description || "(none)"}

## Existing features

${candidateBlocks}

List every existing feature this change is clearly more work on, not just something related or similar. This is usually zero or one — only list more than one when the change plainly spans multiple existing features. When in doubt about a candidate, leave it out.

Return ONLY strict JSON matching this shape — no surrounding text, no code fences:
{"featureIds": ["<id-of-a-matching-feature>", ...]}`;
}

// ---------------------------------------------------------------------------
// Start — split a ticket with no Feature ID into one or more new features
// ---------------------------------------------------------------------------

export function buildFeatureSplitPrompt(
  title: string,
  description: string,
): string {
  return `You are splitting a project change into the distinct new features it introduces, so each can get its own feature ID and docs.

## Change

Title: ${title}
Description: ${description || "(none)"}

Decide how many distinct, separately-shippable features this change introduces. Most changes introduce exactly one — only split into more than one when the title/description clearly describes unrelated pieces of work, not just multiple steps or aspects of the same feature. Give each feature a short, specific title.

Return ONLY strict JSON matching this shape — no surrounding text, no code fences, at least one entry:
{"features": [{"title": "<short feature title>"}]}`;
}

// ---------------------------------------------------------------------------
// OpenSpec init — instructional text written into openspec/config.yaml
// ---------------------------------------------------------------------------

// Kept as an array (not just a joined string) so `addContextPointer()` can check each line's
// presence independently — a repo already wired with an earlier, shorter version of this
// pointer should only gain the lines it's missing on the next `lv init`, not a duplicate of
// the lines it already has.
export const CONTEXT_POINTER_LINES = [
  "LV Crew context: before proposing, designing, or implementing anything, read:",
  "- the feature docs under `docs/features/<feature-id>/{overview.md,design.md}` for any feature IDs this change touches",
  "- the current change's ticket/description context in `docs/changes/<change-id>/state.yaml` (the directory matching the current git branch)",
  "- if you are running `/opsx:sync` directly (syncing delta specs to main specs without archiving), also refresh docs for any feature IDs this change touches by running `lv bootstrap <feature-id>` — this is a convention, not enforced by any tooling check",
  "- also check `.lv.yaml` for an `output_language` setting; if set, write all generated artifact prose in that language — code blocks, identifiers, file paths, and command names stay untranslated, headings may stay in English",
];

// Multi-line so it renders as a YAML block scalar (`context: |`) — kept short and generic
// enough to apply to every change, so `lv start` never has to rewrite it per-change.
export const CONTEXT_POINTER = CONTEXT_POINTER_LINES.join("\n");

// Written into `operations.archive.guidance` — read by the generated `/opsx:archive` workflow
// (`openspec instructions archive --change <name> --json`'s `operationGuidance` field) and
// followed advisorily, never blocking the archive if ignored.
export const ARCHIVE_GUIDANCE =
  "When archiving, sync all delta to OpenSpec specs by default. Before completing this archive, refresh the docs of every feature this change touches by running `lv bootstrap <feature-id>`: use the feature IDs recorded in this change's `docs/changes/<change-id>/state.yaml` when present; otherwise, for each of this change's delta spec capability paths, treat its leading path segment as a feature ID and refresh it if a matching `docs/features/<id>/` directory exists.";

// Patched into the generated `/opsx:propose` workflow file(s) by `addProposeStateAutoload()`
// in init.ts, as a new line inserted right before that workflow's "ask the user" step. The
// `context:` pointer above can't do this job itself — it's only surfaced once an artifact's
// `openspec instructions` is read, which happens after the workflow's Step 1 (deciding the
// change name/description) has already run.
export const PROPOSE_STATE_AUTOLOAD_LINE =
  "LV Crew: before asking, check for a `docs/changes/<change-id>/state.yaml` whose `branch` field matches the current git branch. If one exists, use its `title` to derive the kebab-case change name and use its non-empty `description` as the change description below; otherwise, fall back to its `title` as the change description. Only ask the user if no matching `state.yaml` exists, or it has no usable title/description.";

// Patched into the generated `/opsx:propose` workflow file(s) by `addProposeLinkInstruction()`
// in init.ts, as a new line inserted right after that workflow's "Create the change directory"
// step creates the OpenSpec change. Records the new change against LV's own change context so
// `lv status` can later report on it — see `lv-status/openspec-next-action`.
export const PROPOSE_LINK_CHANGE_LINE =
  'LV Crew: after `openspec new change` succeeds, check for a `docs/changes/<change-id>/state.yaml` whose `branch` field matches the current git branch. If one exists, run `lv link "<name>"` (the name just used for `openspec new change`) to record this OpenSpec change against it. Skip this step if no matching `state.yaml` exists.';

// Patched into the generated `/opsx:propose` workflow file(s) by `addProposeUiDesignInstruction()`
// in init.ts, at the same insertion point as `PROPOSE_STATE_AUTOLOAD_LINE` (step 1's "ask the
// user" anchor). Deliberately scoped to `/opsx:propose` only — not the generic `context:`
// pointer — because analyzing a UI design is only useful for the one artifact that reflects it
// (proposal.md's What Changes/Impact); every other OpenSpec workflow (apply/sync/archive) would
// otherwise carry this instruction on every invocation for no benefit, since by the time they
// run, whatever was learned from the design should already be captured in proposal.md/design.md
// text. Explicitly names the `proposal` artifact so the instruction doesn't also apply when step
// 5's generic per-artifact loop creates specs/design/tasks.
export const PROPOSE_UI_DESIGN_LINE =
  'LV Crew: that same `state.yaml` may also have a non-empty `ui_design`. If it does, then specifically when you create the `proposal` artifact in step 5 below (not the other artifact types), attempt to view or fetch each reference and reflect what you observe in `proposal.md`\'s "What Changes" and "Impact" sections — for a Figma URL, prefer the Figma Dev Mode MCP Server\'s tools (e.g. `get_code`, `get_screenshot`, `get_variable_defs`) when one is configured in your environment; otherwise use `WebFetch` for a URL, or read a local/downloadable image or PDF directly. If the asset can\'t be accessed by any available method, fall back to citing the raw reference string.';

// Patched into the generated `/opsx:propose` workflow file(s) by `addProposeAttachmentInstruction()`
// in init.ts, at the same insertion point as `PROPOSE_STATE_AUTOLOAD_LINE`/`PROPOSE_UI_DESIGN_LINE`
// (step 1's "ask the user" anchor). Deliberately scoped to `/opsx:propose` only, same reasoning as
// `PROPOSE_UI_DESIGN_LINE`. Unlike a `ui_design` reference (a remote URL of unknown shape), an
// attachment is already a local file on disk by the time this runs — `lv start` downloaded it —
// so the instruction only needs a plain `Read`, with one fallback for formats `Read` can't handle
// (e.g. video).
export const PROPOSE_ATTACHMENT_LINE =
  'LV Crew: that same `state.yaml` may also have a non-empty `attachments` — repo-relative paths to files `lv start` already downloaded from the ticket. If it does, then specifically when you create the `proposal` artifact in step 5 below (not the other artifact types), read each listed file directly (no fetch needed) and reflect what you observe in `proposal.md`\'s "What Changes" and "Impact" sections. If a file\'s format can\'t be read directly (e.g. a video), cite its name and path instead of guessing at its content.';
