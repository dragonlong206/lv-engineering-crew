import type { ExistingFeature } from "./engine/feature-id.js";

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export const AUTO_GENERATED_HEADER = `<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

`;

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

export function buildBootstrapOverviewPrompt(
  featureId: string,
  codeBlock: string,
): string {
  return `You are a systems analyst. Read the following code and generate an overview.md document for the feature '${featureId}'.

overview.md should cover:
- Purpose of the feature
- Main components
- High-level flow
- Constraints and assumptions
- Current state of the code

Be concise. Return only the Markdown content — no surrounding text.

## Code

${codeBlock}`;
}

export function buildBootstrapDesignPrompt(
  featureId: string,
  codeBlock: string,
): string {
  return `You are a systems designer. Read the following code and generate a design.md document for the feature '${featureId}'.

design.md should cover:
- Architecture and layers
- Data model / schema
- APIs / interfaces
- Key design decisions

Be concise. Return only the Markdown content — no surrounding text.

## Code

${codeBlock}`;
}

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
// Bootstrap — autonomous codebase scan mode (no --paths)
// ---------------------------------------------------------------------------

export const BOOTSTRAP_AGENT_INSTRUCTIONS = `You are a senior engineer documenting a feature by exploring an actual codebase. You have tools to list files, read files, and search code — use them to ground everything you write in what is really in the repository. Do not invent components, APIs, or behavior you have not verified by reading the code.

You may be given an existing draft overview.md (and design.md). "Refine" does NOT mean copy the draft forward with light rewording — it means: keep sections whose claims you've verified are still true (e.g. purpose/scope/constraints that aren't about code), and rewrite any section whose factual claims are about the code (function signatures, CLI flags/options, file names, module names, architecture) purely from what you observe in your exploration this run. Never trust the draft for a code fact — verify it, and if you didn't check it, don't assert it. A draft that's gone stale (renamed functions, new options, new files) is the normal case, not the exception — assume it may be wrong until you've confirmed otherwise.

You may instead (or additionally) be given a short feature name/description hint. Use it to seed your search — treat it as a starting hypothesis about what the feature is and where to look, not as text to copy verbatim into the output. If neither a draft nor a hint is given, generate both documents purely from what you find in the code.

If the feature is a CLI command, tool, or public API, use searchCode to find where it's registered/exposed (e.g. the command-registration file) so you capture its current full set of flags/parameters, not just what one implementation file suggests.

Be economical: use listFiles/searchCode to narrow down to the handful of files that actually matter, then readFile only those — but do not skip re-reading a file just because the draft already describes it; the draft is what you're trying to correct. Aim to finish exploring within about 10 tool calls and always produce a final JSON answer — never end your turn on a tool call.

Be concise. Do not use em-dashes for parenthetical remarks.

Return ONLY strict JSON matching this shape — no surrounding text, no code fences:
{"overviewMarkdown": "...", "designMarkdown": "..."}

overviewMarkdown must cover: Purpose of the feature, Main components, High-level flow, Constraints and assumptions, Current state of the code.
designMarkdown must cover: Architecture and layers, Data model / schema, APIs / interfaces, Key design decisions.`;

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
];

// Multi-line so it renders as a YAML block scalar (`context: |`) — kept short and generic
// enough to apply to every change, so `lv start` never has to rewrite it per-change.
export const CONTEXT_POINTER = CONTEXT_POINTER_LINES.join("\n");

// Written into `operations.archive.guidance` — read by the generated `/opsx:archive` workflow
// (`openspec instructions archive --change <name> --json`'s `operationGuidance` field) and
// followed advisorily, never blocking the archive if ignored.
export const ARCHIVE_GUIDANCE =
  "Before completing this archive, refresh the docs of every feature this change touches by running `lv bootstrap <feature-id>`: use the feature IDs recorded in this change's `docs/changes/<change-id>/state.yaml` when present; otherwise, for each of this change's delta spec capability paths, treat its leading path segment as a feature ID and refresh it if a matching `docs/features/<id>/` directory exists.";

// Patched into the generated `/opsx:propose` workflow file(s) by `addProposeStateAutoload()`
// in init.ts, as a new line inserted right before that workflow's "ask the user" step. The
// `context:` pointer above can't do this job itself — it's only surfaced once an artifact's
// `openspec instructions` is read, which happens after the workflow's Step 1 (deciding the
// change name/description) has already run.
export const PROPOSE_STATE_AUTOLOAD_LINE =
  "LV Crew: before asking, check for a `docs/changes/<change-id>/state.yaml` whose `branch` field matches the current git branch. If one exists, use its `title` to derive the kebab-case change name and its `description` as the change description below, skipping the question entirely. Only ask the user if no matching `state.yaml` exists, or it has no usable title/description.";

// Patched into the generated `/opsx:propose` workflow file(s) by `addProposeLinkInstruction()`
// in init.ts, as a new line inserted right after that workflow's "Create the change directory"
// step creates the OpenSpec change. Records the new change against LV's own change context so
// `lv status` can later report on it — see `lv-status/openspec-next-action`.
export const PROPOSE_LINK_CHANGE_LINE =
  'LV Crew: after `openspec new change` succeeds, check for a `docs/changes/<change-id>/state.yaml` whose `branch` field matches the current git branch. If one exists, run `lv link "<name>"` (the name just used for `openspec new change`) to record this OpenSpec change against it. Skip this step if no matching `state.yaml` exists.';

export function buildBootstrapScanPrompt(
  featureId: string,
  repoRoot: string,
  existingOverviewMd?: string,
  existingDesignMd?: string,
  featureName?: string,
  featureDescription?: string,
): string {
  const draftParts: string[] = [];
  if (featureName || featureDescription) {
    draftParts.push(
      `## Feature hint\n${featureName ? `Name: ${featureName}\n` : ""}${featureDescription ? `Description: ${featureDescription}\n` : ""}`,
    );
  }
  if (existingOverviewMd) {
    draftParts.push(
      `## Existing draft overview.md (refine this, don't discard it)\n\n${existingOverviewMd}`,
    );
  }
  if (existingDesignMd) {
    draftParts.push(
      `## Existing draft design.md (refine this, don't discard it)\n\n${existingDesignMd}`,
    );
  }
  const draftSection =
    draftParts.length > 0 ? `${draftParts.join("\n\n")}\n\n` : "";

  return `Explore the codebase to produce finalized overview.md and design.md content for the feature '${featureId}'.

**Repo root:** ${repoRoot}

${draftSection}Use your tools (listFiles, readFile, searchCode) to find and read the code relevant to '${featureId}' before writing anything.`;
}
