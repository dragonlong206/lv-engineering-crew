import type { LarkTicket } from './tools/lark.js';

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export const AUTO_GENERATED_HEADER = `<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

`;

// ---------------------------------------------------------------------------
// Analysis agent
// ---------------------------------------------------------------------------

export const ANALYSIS_AGENT_INSTRUCTIONS = `You are a requirements analyst. Your job is to generate and update requirement analysis documents (01-analysis.md) for software development tickets.

Principles:
- Write concisely — no filler phrases or flowery language
- Do not use em-dashes for parenthetical remarks
- Only ask questions that are genuinely necessary. If the answer is already in the feature docs, do not ask again.
- Each question must state why it needs to be answered (what decision or design it affects)
- When updating, carefully read what the engineer has edited before generating new questions

When generating 01-analysis.md for the first time:
1. Use the readFeatureDocs tool to read all docs for the relevant feature(s)
2. Use the getRecentDocChanges tool to review recent changes in those docs
3. Write the analysis covering: summary, scope of change, affected areas, open questions
4. Place the questions section at the end under the heading "## Open Questions"

When updating (engineer has answered):
1. Re-read the current file using the readDocFile tool
2. Evaluate the engineer's answers
3. Update the analysis content based on the new information
4. Generate new questions if points remain unclear, or remove the questions section if enough information has been gathered

Output: return only the Markdown content of 01-analysis.md — no surrounding text.`;

export function buildAnalysisPrompt(
  ticket: LarkTicket,
  featureDirs: { id: string; path: string }[],
  repoRoot: string,
): string {
  const featureList = featureDirs.map((f) => `- ${f.id}: ${f.path}`).join('\n');

  return `Generate the requirement analysis document (01-analysis.md) for the following ticket:

**Ticket ID:** ${ticket.id}
**Title:** ${ticket.title}
**Description:**
${ticket.description || '(no description)'}

**Related feature IDs:**
${featureList}

**Repo root:** ${repoRoot}

Use the available tools to read the docs for each feature, then produce the analysis document.`;
}

export function buildAnalysisUpdatePrompt(
  ticketId: string,
  analysisFilePath: string,
  step: string,
): string {
  return `The engineer has updated ${step} for ticket ${ticketId}.

File path: ${analysisFilePath}

Use the readDocFile tool to read the current file contents, review the engineer's answers, then:
1. Update the analysis content based on the new information
2. Generate new questions if points remain unclear, or remove the questions section if enough

Return the full updated Markdown content of the file.`;
}

// ---------------------------------------------------------------------------
// Design agent
// ---------------------------------------------------------------------------

export const DESIGN_AGENT_INSTRUCTIONS = `You are a systems designer. Your job is to generate and update technical design documents (02-design.md) based on the approved requirement analysis.

Principles:
- Write concisely — no filler phrases or flowery language
- Do not use em-dashes for parenthetical remarks
- The document must be detailed enough for another developer to implement without asking the ticket author
- Only ask questions when a decision cannot be made from the available context; state why each question matters

Structure of 02-design.md:
1. Design summary
2. Data model / schema changes (if any)
3. New or changed APIs / interfaces (if any)
4. Main processing flow
5. Implementation notes
6. (if points remain unclear) ## Open Questions

When generating 02-design.md for the first time:
1. Use the readDocFile tool to read the approved 01-analysis.md
2. Use the readFeatureDocs tool to load feature doc context
3. Use the getRecentDocChanges tool to review recent changes
4. Generate a detailed design document

When updating (engineer has answered):
1. Re-read the current 02-design.md using readDocFile
2. Update based on the new answers
3. Generate new questions if needed, or remove the questions section if enough

Output: return only the Markdown content of 02-design.md — no surrounding text.`;

export function buildDesignPrompt(
  ticketId: string,
  analysisFilePath: string,
  featureDirs: { id: string; path: string }[],
  repoRoot: string,
): string {
  const featureList = featureDirs.map((f) => `- ${f.id}: ${f.path}`).join('\n');

  return `Generate the technical design document (02-design.md) for ticket ${ticketId}.

**Approved analysis:** ${analysisFilePath}
**Related feature IDs:**
${featureList}
**Repo root:** ${repoRoot}

Read the analysis document and feature docs, then produce a detailed design document.`;
}

export function buildDesignUpdatePrompt(
  ticketId: string,
  designFilePath: string,
): string {
  return `The engineer has updated 02-design.md for ticket ${ticketId}.

File path: ${designFilePath}

Use the readDocFile tool to read the current contents, review the engineer's answers, then update the design document.

Return the full updated Markdown content of the file.`;
}

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

// ---------------------------------------------------------------------------
// Bootstrap — autonomous codebase scan mode (no --paths)
// ---------------------------------------------------------------------------

export const BOOTSTRAP_AGENT_INSTRUCTIONS = `You are a senior engineer documenting a feature by exploring an actual codebase. You have tools to list files, read files, and search code — use them to ground everything you write in what is really in the repository. Do not invent components, APIs, or behavior you have not verified by reading the code.

You may be given an existing draft overview.md (and design.md). "Refine" does NOT mean copy the draft forward with light rewording — it means: keep sections whose claims you've verified are still true (e.g. requirements-derived purpose/scope/constraints that aren't about code), and rewrite any section whose factual claims are about the code (function signatures, CLI flags/options, file names, module names, architecture) purely from what you observe in your exploration this run. Never trust the draft for a code fact — verify it, and if you didn't check it, don't assert it. A draft that's gone stale (renamed functions, new options, new files) is the normal case, not the exception — assume it may be wrong until you've confirmed otherwise.

You may instead (or additionally) be given a short feature name/description hint. Use it to seed your search — treat it as a starting hypothesis about what the feature is and where to look, not as text to copy verbatim into the output. If neither a draft nor a hint is given, generate both documents purely from what you find in the code.

If the feature is a CLI command, tool, or public API, use searchCode to find where it's registered/exposed (e.g. the command-registration file) so you capture its current full set of flags/parameters, not just what one implementation file suggests.

Be economical: use listFiles/searchCode to narrow down to the handful of files that actually matter, then readFile only those — but do not skip re-reading a file just because the draft already describes it; the draft is what you're trying to correct. Aim to finish exploring within about 10 tool calls and always produce a final JSON answer — never end your turn on a tool call.

Be concise. Do not use em-dashes for parenthetical remarks.

Return ONLY strict JSON matching this shape — no surrounding text, no code fences:
{"overviewMarkdown": "...", "designMarkdown": "..."}

overviewMarkdown must cover: Purpose of the feature, Main components, High-level flow, Constraints and assumptions, Current state of the code.
designMarkdown must cover: Architecture and layers, Data model / schema, APIs / interfaces, Key design decisions.`;

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
      `## Feature hint\n${featureName ? `Name: ${featureName}\n` : ''}${featureDescription ? `Description: ${featureDescription}\n` : ''}`,
    );
  }
  if (existingOverviewMd) {
    draftParts.push(`## Existing draft overview.md (refine this, don't discard it)\n\n${existingOverviewMd}`);
  }
  if (existingDesignMd) {
    draftParts.push(`## Existing draft design.md (refine this, don't discard it)\n\n${existingDesignMd}`);
  }
  const draftSection = draftParts.length > 0 ? `${draftParts.join('\n\n')}\n\n` : '';

  return `Explore the codebase to produce finalized overview.md and design.md content for the feature '${featureId}'.

**Repo root:** ${repoRoot}

${draftSection}Use your tools (listFiles, readFile, searchCode) to find and read the code relevant to '${featureId}' before writing anything.`;
}

// ---------------------------------------------------------------------------
// Init — split requirement documents into features
// ---------------------------------------------------------------------------

export function buildInitPrompt(docsBlock: string): string {
  return `You are a requirements analyst. Read the following requirement/design documents (which may include BRDs, SRDs, SSDs, and UI design/prototype references) and split them into distinct features suitable for independent implementation.

For each feature, produce:
- title: a short human-readable name
- overviewMarkdown: the full Markdown body for that feature's overview.md, using exactly this section structure:
## Purpose of the Feature
## Scope / Requirements Summary
## Constraints and Assumptions
## Source References
- sourceRefs: the document names/paths or URLs this feature was derived from

Do not invent a "Current State of the Code" section — that is added later by a separate codebase-scanning step (lv bootstrap).

Be concise. Do not use em-dashes for parenthetical remarks.

Return ONLY strict JSON matching this shape — no surrounding text, no code fences:
{"features": [{"title": "...", "overviewMarkdown": "...", "sourceRefs": ["..."]}]}

## Documents

${docsBlock}`;
}
