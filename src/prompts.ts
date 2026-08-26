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

Decide whether the change above is clearly more work on exactly one of these existing features. Only pick one if you are confident it's the same feature, not just a related or similar one — when in doubt, answer null.

Return ONLY strict JSON matching this shape — no surrounding text, no code fences:
{"featureId": "<id-of-the-matching-feature-or-null>"}`;
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
  "Before completing this archive, for each feature ID recorded in this change, run `lv bootstrap <feature-id>` to refresh that feature's docs against the code this change shipped.";

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
