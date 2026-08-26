// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export const AUTO_GENERATED_HEADER = `<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

`;

// Requirement/Scenario convention (docs/lv-engineering-crew-spec.md §4.2a), shared by every
// prompt that reads or writes a feature's requirements.md or a change's spec delta files.
export const REQUIREMENT_SCENARIO_CONVENTION = `Requirement/Scenario format:
- Each requirement is a "### Requirement: <Name>" heading (descriptive, under ~50 characters, unique within the file after trimming whitespace), immediately followed by a SHALL statement describing the core behavior.
- Under each requirement, one or more "#### Scenario: <situation>" headings give concrete, testable examples as bullets: **WHEN** (trigger), **THEN** (outcome), optional **GIVEN** (initial state) and **AND** (additional condition/outcome).
- State externally observable behavior only — inputs, outputs, constraints. Implementation detail (library choices, function/class structure, execution mechanics) belongs in design.md, not here.
- A spec delta file (one per touched feature) proposes changes against a feature's requirements.md using "## ADDED Requirements" / "## MODIFIED Requirements" / "## REMOVED Requirements" sections, matching requirement names verbatim against the target file's headings.`;

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

export function buildBootstrapOverviewPrompt(featureId: string, codeBlock: string): string {
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

export function buildBootstrapDesignPrompt(featureId: string, codeBlock: string): string {
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

export function buildBootstrapRequirementsPrompt(featureId: string, codeBlock: string): string {
  return `You are a requirements analyst. Read the following code and generate a requirements.md document for the feature '${featureId}', describing its current externally observable behavior.

${REQUIREMENT_SCENARIO_CONVENTION}

Be concise. Return only the Markdown content — no surrounding text, no code fences.

## Code

${codeBlock}`;
}

// ---------------------------------------------------------------------------
// Bootstrap — autonomous codebase scan mode (no --paths)
// ---------------------------------------------------------------------------

export const BOOTSTRAP_AGENT_INSTRUCTIONS = `You are a senior engineer documenting a feature by exploring an actual codebase. You have tools to list files, read files, and search code — use them to ground everything you write in what is really in the repository. Do not invent components, APIs, or behavior you have not verified by reading the code.

You may be given an existing draft overview.md (and design.md, and requirements.md). "Refine" does NOT mean copy the draft forward with light rewording — it means: keep sections whose claims you've verified are still true (e.g. requirements-derived purpose/scope/constraints that aren't about code), and rewrite any section whose factual claims are about the code (function signatures, CLI flags/options, file names, module names, architecture) purely from what you observe in your exploration this run. Never trust the draft for a code fact — verify it, and if you didn't check it, don't assert it. A draft that's gone stale (renamed functions, new options, new files) is the normal case, not the exception — assume it may be wrong until you've confirmed otherwise.

You may instead (or additionally) be given a short feature name/description hint. Use it to seed your search — treat it as a starting hypothesis about what the feature is and where to look, not as text to copy verbatim into the output. If neither a draft nor a hint is given, generate all three documents purely from what you find in the code.

If the feature is a CLI command, tool, or public API, use searchCode to find where it's registered/exposed (e.g. the command-registration file) so you capture its current full set of flags/parameters, not just what one implementation file suggests.

Be economical: use listFiles/searchCode to narrow down to the handful of files that actually matter, then readFile only those — but do not skip re-reading a file just because the draft already describes it; the draft is what you're trying to correct. Aim to finish exploring within about 10 tool calls and always produce a final JSON answer — never end your turn on a tool call.

Be concise. Do not use em-dashes for parenthetical remarks.

${REQUIREMENT_SCENARIO_CONVENTION}

Return ONLY strict JSON matching this shape — no surrounding text, no code fences:
{"overviewMarkdown": "...", "designMarkdown": "...", "requirementsMarkdown": "..."}

overviewMarkdown must cover: Purpose of the feature, Main components, High-level flow, Constraints and assumptions, Current state of the code.
designMarkdown must cover: Architecture and layers, Data model / schema, APIs / interfaces, Key design decisions.
requirementsMarkdown must follow the Requirement/Scenario convention above, describing the feature's current externally observable behavior.`;

export function buildBootstrapScanPrompt(
  featureId: string,
  repoRoot: string,
  existingOverviewMd?: string,
  existingDesignMd?: string,
  featureName?: string,
  featureDescription?: string,
  existingRequirementsMd?: string,
): string {
  const draftParts: string[] = [];
  if (featureName || featureDescription) {
    draftParts.push(
      `## Feature hint\n${featureName ? `Name: ${featureName}\n` : ''}${featureDescription ? `Description: ${featureDescription}\n` : ''}`,
    );
  }
  if (existingOverviewMd) {
    draftParts.push(`## Existing draft overview.md (refine this, don't discard it)\n\n${existingOverviewMd}`);
  }
  if (existingDesignMd) {
    draftParts.push(`## Existing draft design.md (refine this, don't discard it)\n\n${existingDesignMd}`);
  }
  if (existingRequirementsMd) {
    draftParts.push(`## Existing draft requirements.md (refine this, don't discard it)\n\n${existingRequirementsMd}`);
  }
  const draftSection = draftParts.length > 0 ? `${draftParts.join('\n\n')}\n\n` : '';

  return `Explore the codebase to produce finalized overview.md, design.md, and requirements.md content for the feature '${featureId}'.

**Repo root:** ${repoRoot}

${draftSection}Use your tools (listFiles, readFile, searchCode) to find and read the code relevant to '${featureId}' before writing anything.`;
}
