import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { execa } from "execa";
import which from "which";
import { getRepoRoot, loadConfig } from "../config.js";
import type { Config } from "../types.js";
import { printInfo, printSuccess, printError, printWarn, confirm, writeFile } from "./helpers.js";
import {
  CONTEXT_POINTER_LINES,
  LEGACY_CONTEXT_POINTER_SYNC_LINE,
  ARCHIVE_GUIDANCE,
  LEGACY_ARCHIVE_GUIDANCE,
  APPLY_TEST_GUIDANCE,
  TASKS_TEST_RULE,
  PROPOSE_STATE_AUTOLOAD_LINE,
  PROPOSE_LINK_CHANGE_LINE,
  PROPOSE_UI_DESIGN_LINE,
  PROPOSE_ATTACHMENT_LINE,
  PROPOSE_PARENT_CONTEXT_LINE,
  buildLvBootstrapSkillFile,
  buildLvBootstrapClaudeCommandFile,
  buildLvBootstrapCursorCommandFile,
} from "../prompts.js";

export interface InitOptions {
  tool?: string;
}

// The unscoped npm package `openspec` is an unrelated package — the actual CLI ships as
// `@fission-ai/openspec` (bin name `openspec`).
const OPENSPEC_PACKAGE = "@fission-ai/openspec";

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// Builds a regex matching `text` with any run of whitespace in it treated as "one or more
// whitespace characters" — so it locates `text` inside a YAML-reflowed/wrapped/folded copy of
// itself (differing line breaks, differing wrap points) instead of requiring a byte-exact
// substring or a known paragraph boundary.
function flexibleWhitespacePattern(text: string): RegExp {
  const source = text
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  return new RegExp(source);
}

/**
 * Recovers a guidance/rules list item that was meant to be a string but loaded as a one-key
 * mapping — what an unquoted plain scalar containing ": " parses as. The original
 * `addArchiveGuidance()` (`5377e7f`, before `797e2b2` started quoting) wrote the legacy archive
 * wording unquoted, and that wording contains "`lv bootstrap <feature-id>`: use ...", so
 * OpenSpec (which requires every item to be a string) silently discarded the whole list. YAML
 * split the scalar at its first ": ", so `"<key>: <value>"` rebuilds the text as written.
 * Anything else that isn't a string is returned as-is — not something LV can reinterpret.
 */
function coerceListEntry(entry: unknown): { value: unknown; repaired: boolean } {
  if (typeof entry === "string" || entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    return { value: entry, repaired: false };
  }
  const pairs = Object.entries(entry as Record<string, unknown>);
  if (pairs.length !== 1) return { value: entry, repaired: false };
  const [key, val] = pairs[0];
  if (val !== null && typeof val === "object") return { value: entry, repaired: false };
  return { value: `${key}: ${val ?? ""}`.trimEnd(), repaired: true };
}

/** Maps every item of `list` through `coerceListEntry()`, reporting whether any were repaired. */
function coerceList(list: unknown[]): { list: unknown[]; repaired: boolean } {
  let repaired = false;
  const coerced = list.map((entry) => {
    const result = coerceListEntry(entry);
    repaired ||= result.repaired;
    return result.value;
  });
  return { list: coerced, repaired };
}

/**
 * Resolves `openspec` on PATH directly instead of inferring "not installed" from the shape of a
 * spawn error — `execa`/`cross-spawn`'s ENOENT emulation on Windows relays through `cmd.exe` and
 * doesn't reliably surface `err.code === "ENOENT"` for a missing executable (see design.md of
 * lv-init-does-not-install-openspec-on-windows). `which` is the same resolver cross-spawn itself
 * uses, so this matches what `execa` would actually attempt to spawn on any platform.
 */
function isOpenSpecInstalled(): boolean {
  return which.sync("openspec", { nothrow: true }) !== null;
}

export async function runInit(opts: InitOptions): Promise<void> {
  const repoRoot = getRepoRoot();

  if (!isOpenSpecInstalled()) {
    const proceed = await confirm(
      `OpenSpec CLI not found or not installed properly. Install ${OPENSPEC_PACKAGE} globally now? (y/N) `,
    );
    if (!proceed) {
      printInfo(`Skipping install. Run 'npm install -g ${OPENSPEC_PACKAGE}' manually, then re-run 'lv init'.`);
      return;
    }

    printInfo(`Installing ${OPENSPEC_PACKAGE} globally...`);
    try {
      await execa("npm", ["install", "-g", OPENSPEC_PACKAGE], { stdio: "inherit" });
    } catch (err) {
      printError(`Failed to install ${OPENSPEC_PACKAGE}: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  printInfo(opts.tool ? `Installing OpenSpec for '${opts.tool}'...` : "Installing OpenSpec...");

  const args = ["init", repoRoot];
  if (opts.tool) args.push("--tools", opts.tool);

  try {
    await execa("openspec", args, {
      cwd: repoRoot,
      stdout: "inherit",
      // Fan out to both a live terminal stream and execa's own capture, so the failure
      // message below can include `stderr` without losing real-time progress output.
      stderr: ["pipe", "inherit"],
    });
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr;
    const detail = stderr ? `\n${stderr}` : "";
    printError(`OpenSpec install failed: ${(err as Error).message}${detail}`);
    process.exit(1);
  }

  addContextPointer(repoRoot);
  addOperationGuidance(repoRoot, [
    { operation: "archive", text: ARCHIVE_GUIDANCE, legacy: LEGACY_ARCHIVE_GUIDANCE },
    { operation: "apply", text: APPLY_TEST_GUIDANCE },
  ]);
  addArtifactRules(repoRoot, { tasks: [TASKS_TEST_RULE] });
  addProposeStateAutoload(repoRoot);
  addProposeLinkInstruction(repoRoot);
  addProposeUiDesignInstruction(repoRoot);
  addProposeAttachmentInstruction(repoRoot);
  addProposeParentContextInstruction(repoRoot);
  installLvBootstrapSkill(repoRoot);
  setApplyModelOverride(repoRoot, loadConfig());

  printSuccess("OpenSpec installed and wired to LV context.");
  console.log(`\nNext: run 'lv start <ticket-id>' or 'lv start --description "..."' to begin a change.`);
}

/**
 * Idempotently wires OpenSpec's project-wide `context:` (openspec/config.yaml) to point at
 * LV's feature docs and per-change state.yaml, so OpenSpec's explore/propose/apply workflows
 * load them automatically instead of the engineer pasting them into every prompt. Each line of
 * `CONTEXT_POINTER_LINES` is checked for presence independently, so a repo already wired with
 * an earlier, shorter version of the pointer only gains the lines it's missing.
 */
function addContextPointer(repoRoot: string): void {
  const configPath = path.join(repoRoot, "openspec", "config.yaml");
  if (!fs.existsSync(configPath)) {
    printError(`Expected OpenSpec config at ${configPath} after install — not found.`);
    return;
  }

  let raw = fs.readFileSync(configPath, "utf-8");
  const hasActiveContextKey = /^context:/m.test(raw);

  // Upgrade a previously-installed copy of the now-superseded sync-convention line (index 3) in
  // place, before checking what's still missing below — otherwise the old line would be left in
  // the file while the corrected line gets appended alongside it as a second, duplicate entry.
  // `context:` is stored as one joined multi-line string, re-wrapped/folded by js-yaml on write
  // (and, across incremental `lv init` runs over this repo's history, joined with an inconsistent
  // mix of single newlines and blank-line separators between entries) — so the target line is
  // matched with a whitespace-flexible regex built from its own words, not a paragraph split or
  // an exact substring of the (differently-wrapped) constant.
  if (
    hasActiveContextKey &&
    normalizeWhitespace(raw).includes(normalizeWhitespace(LEGACY_CONTEXT_POINTER_SYNC_LINE)) &&
    !normalizeWhitespace(raw).includes(normalizeWhitespace(CONTEXT_POINTER_LINES[3]))
  ) {
    const parsed = (yaml.load(raw) as Record<string, unknown>) ?? {};
    const existing = typeof parsed.context === "string" ? parsed.context : "";
    const legacyPattern = flexibleWhitespacePattern(LEGACY_CONTEXT_POINTER_SYNC_LINE);
    if (legacyPattern.test(existing)) {
      parsed.context = existing.replace(legacyPattern, CONTEXT_POINTER_LINES[3]);
      fs.writeFileSync(configPath, yaml.dump(parsed, { indent: 2 }), "utf-8");
      raw = fs.readFileSync(configPath, "utf-8");
    }
  }

  // Compare with whitespace collapsed — YAML re-wrapping/indentation (block literal on a
  // fresh append vs. re-flowed by js-yaml's dump on a merge) must not defeat this check.
  const normalizedRaw = normalizeWhitespace(raw);
  const missingLines = CONTEXT_POINTER_LINES.filter(
    (line) => !normalizedRaw.includes(normalizeWhitespace(line)),
  );
  if (missingLines.length === 0) return; // already fully wired

  const addition = missingLines.join("\n");

  if (!hasActiveContextKey) {
    // Fresh template — `context:` only appears commented out. Append a new top-level key
    // instead of round-tripping through js-yaml, so the template's explanatory comments
    // stay intact.
    const block = `\ncontext: |\n${addition
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n")}\n`;
    fs.appendFileSync(configPath, block, "utf-8");
    return;
  }

  // An engineer already customized `context:` (or an earlier `lv init` already wrote part of
  // this pointer) — merge properly via YAML instead of a blind text append, appending only the
  // lines not already present, at the cost of losing this file's comments on this one rewrite.
  const parsed = (yaml.load(raw) as Record<string, unknown>) ?? {};
  const existing = typeof parsed.context === "string" ? parsed.context : "";
  parsed.context = existing ? `${existing}\n\n${addition}` : addition;
  fs.writeFileSync(configPath, yaml.dump(parsed, { indent: 2 }), "utf-8");
}

interface OperationGuidanceEntry {
  operation: string;
  text: string;
  // Superseded wording of `text`, upgraded in place if found instead of appending `text` as a
  // second, duplicate entry.
  legacy?: string;
}

/**
 * Idempotently wires LV's entries into OpenSpec's `operations.<id>.guidance` (openspec/config.yaml)
 * — read via `openspec instructions <id> --change <name> --json`'s `operationGuidance` field,
 * which the generated `/opsx:archive` and `/opsx:apply` workflows already read and follow
 * advisorily (never blocking if ignored). Handles every operation in one pass rather than one
 * call per operation: a first call appending a fresh `operations:` block would make the next
 * call see an active key and take the YAML round-trip branch, stripping the template's comments
 * on every fresh install (see design.md Decision 3 of openspec-apply-implement-spec-tests).
 */
function addOperationGuidance(repoRoot: string, entries: OperationGuidanceEntry[]): void {
  const configPath = path.join(repoRoot, "openspec", "config.yaml");
  if (!fs.existsSync(configPath)) {
    printError(`Expected OpenSpec config at ${configPath} after install — not found.`);
    return;
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  const hasActiveOperationsKey = /^operations:/m.test(raw);

  if (!hasActiveOperationsKey) {
    // Fresh template — `operations:` only appears commented out. Append a new top-level key
    // instead of round-tripping through js-yaml, so the template's explanatory comments
    // stay intact. JSON.stringify quotes each value as a valid YAML double-quoted scalar —
    // required because the guidance text contains ": ", which is ambiguous unquoted as a
    // block-sequence item (a parser reads it as an implicit single-key mapping, not a plain
    // string) and corrupts into a duplicate entry the next time this file is parsed and
    // re-dumped (e.g. by addContextPointer()'s merge branch).
    const byOperation = new Map<string, string[]>();
    for (const { operation, text } of entries) {
      byOperation.set(operation, [...(byOperation.get(operation) ?? []), text]);
    }
    let block = "\noperations:\n";
    for (const [operation, texts] of byOperation) {
      block += `  ${operation}:\n    guidance:\n${texts.map((t) => `      - ${JSON.stringify(t)}\n`).join("")}`;
    }
    fs.appendFileSync(configPath, block, "utf-8");
    return;
  }

  // An engineer already customized `operations:` (or an earlier `lv init` already wrote part of
  // it) — merge via YAML instead of a blind text append, building the missing intermediate keys
  // as needed and keeping any guidance entries LV didn't write, at the cost of losing this
  // file's comments on this one rewrite.
  const parsed = (yaml.load(raw) as Record<string, unknown>) ?? {};
  const operations = (parsed.operations as Record<string, unknown>) ?? {};
  let changed = false;
  const repairedLists: string[] = [];

  for (const { operation, text, legacy } of entries) {
    const op = (operations[operation] as Record<string, unknown>) ?? {};
    const coerced = coerceList(Array.isArray(op.guidance) ? op.guidance : []);
    let guidance = coerced.list;
    let opChanged = coerced.repaired;
    if (coerced.repaired) repairedLists.push(`operations.${operation}.guidance`);

    // Matched via normalized content (not a raw substring) since YAML re-serializes each entry
    // as a folded/wrapped block scalar, not the single-line form the constants are written as.
    const matches = (candidate: string) => (entry: unknown) =>
      typeof entry === "string" && normalizeWhitespace(entry) === normalizeWhitespace(candidate);
    const isLegacy = legacy ? matches(legacy) : () => false;

    if (guidance.some(matches(text))) {
      // Already wired — drop any superseded copy still sitting alongside the current wording.
      const withoutLegacy = guidance.filter((entry) => !isLegacy(entry));
      if (withoutLegacy.length !== guidance.length) {
        guidance = withoutLegacy;
        opChanged = true;
      }
    } else {
      const legacyIndex = guidance.findIndex(isLegacy);
      if (legacyIndex !== -1) {
        // Upgrade the first legacy copy in place, dropping any further ones.
        guidance = guidance
          .map((entry, i) => (i === legacyIndex ? text : entry))
          .filter((entry, i) => i === legacyIndex || !isLegacy(entry));
      } else {
        guidance.push(text);
      }
      opChanged = true;
    }

    if (!opChanged) continue;
    op.guidance = guidance;
    operations[operation] = op;
    changed = true;
  }

  if (repairedLists.length > 0) {
    printWarn(
      `Repaired malformed ${repairedLists.join(", ")} in openspec/config.yaml — item(s) written unquoted by an earlier lv init parsed as mappings, so OpenSpec was ignoring the whole list.`,
    );
  }

  if (!changed) return;
  parsed.operations = operations;
  fs.writeFileSync(configPath, yaml.dump(parsed, { indent: 2 }), "utf-8");
}

/**
 * Idempotently wires LV's entries into OpenSpec's per-artifact `rules.<artifact-id>`
 * (openspec/config.yaml) — returned as `rules` by `openspec instructions <artifact-id> --json`,
 * so each rule only constrains the one artifact it's keyed under. Same fresh-append vs.
 * YAML-merge split as `addOperationGuidance()`, keeping any rules an engineer already wrote.
 */
function addArtifactRules(repoRoot: string, rules: Record<string, string[]>): void {
  const configPath = path.join(repoRoot, "openspec", "config.yaml");
  if (!fs.existsSync(configPath)) {
    printError(`Expected OpenSpec config at ${configPath} after install — not found.`);
    return;
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  const hasActiveRulesKey = /^rules:/m.test(raw);

  if (!hasActiveRulesKey) {
    // Fresh template — append instead of round-tripping through js-yaml, quoting each value
    // for the same ": " reason as addOperationGuidance().
    let block = "\nrules:\n";
    for (const [artifactId, texts] of Object.entries(rules)) {
      block += `  ${artifactId}:\n${texts.map((t) => `    - ${JSON.stringify(t)}\n`).join("")}`;
    }
    fs.appendFileSync(configPath, block, "utf-8");
    return;
  }

  const parsed = (yaml.load(raw) as Record<string, unknown>) ?? {};
  const existingRules = (parsed.rules as Record<string, unknown>) ?? {};
  let changed = false;
  const repairedLists: string[] = [];

  for (const [artifactId, texts] of Object.entries(rules)) {
    const { list, repaired } = coerceList(Array.isArray(existingRules[artifactId]) ? existingRules[artifactId] : []);
    if (repaired) {
      repairedLists.push(`rules.${artifactId}`);
      changed = true;
    }
    for (const text of texts) {
      if (list.some((entry) => typeof entry === "string" && normalizeWhitespace(entry) === normalizeWhitespace(text))) continue;
      list.push(text);
      changed = true;
    }
    existingRules[artifactId] = list;
  }

  if (repairedLists.length > 0) {
    printWarn(
      `Repaired malformed ${repairedLists.join(", ")} in openspec/config.yaml — unquoted item(s) parsed as mappings, so OpenSpec was ignoring the whole list.`,
    );
  }

  if (!changed) return;
  parsed.rules = existingRules;
  fs.writeFileSync(configPath, yaml.dump(parsed, { indent: 2 }), "utf-8");
}

// Every location `openspec init`/`openspec update` is known to generate a `/opsx:propose`
// workflow file at, across the tools this repo has installed. A tool this repo hasn't
// installed simply won't have the file, so each is skipped via `fs.existsSync` below rather
// than assumed present.
const PROPOSE_WORKFLOW_FILES = [
  ".claude/commands/opsx/propose.md",
  ".claude/skills/openspec-propose/SKILL.md",
  ".agents/skills/openspec-propose/SKILL.md",
];

// Matches the line that asks the engineer for a change description, in either of the two
// wordings `openspec init` has generated it with ("no input" vs. "no clear input") — the
// autoload line is inserted immediately before whichever one is present, at the same
// indentation, so it reads as part of the same numbered step.
const PROPOSE_ASK_USER_LINE_RE =
  /^( *)If no .*input is provided, ask the user \(open-ended, no preset options\):/m;

const LEGACY_PROPOSE_STATE_AUTOLOAD_LINE =
  "LV Crew: before asking, check for a `docs/changes/<change-id>/state.yaml` whose `branch` field matches the current git branch. If one exists, use its `title` to derive the kebab-case change name and its `description` as the change description below, skipping the question entirely. Only ask the user if no matching `state.yaml` exists, or it has no usable title/description.";

/**
 * Idempotently patches the generated `/opsx:propose` workflow file(s) so they check
 * `docs/changes/<change-id>/state.yaml` for the current branch before asking the engineer to
 * describe the change. `openspec/config.yaml`'s `context:` pointer can't do this on its own —
 * it's only surfaced once an artifact's `openspec instructions` is read, which happens after
 * the workflow's own Step 1 (deciding the change name/description) has already run. Because
 * `openspec update`/`openspec init --force` regenerates these files from scratch and wipes any
 * hand edit, re-run `lv init` after either to re-apply this patch.
 */
function addProposeStateAutoload(repoRoot: string): void {
  for (const relPath of PROPOSE_WORKFLOW_FILES) {
    const filePath = path.join(repoRoot, relPath);
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, "utf-8");
    if (normalizeWhitespace(raw).includes(normalizeWhitespace(PROPOSE_STATE_AUTOLOAD_LINE))) {
      continue; // already patched
    }

    if (raw.includes(LEGACY_PROPOSE_STATE_AUTOLOAD_LINE)) {
      const patched = raw.replaceAll(LEGACY_PROPOSE_STATE_AUTOLOAD_LINE, PROPOSE_STATE_AUTOLOAD_LINE);
      fs.writeFileSync(filePath, patched, "utf-8");
      continue;
    }

    const match = raw.match(PROPOSE_ASK_USER_LINE_RE);
    if (!match || match.index === undefined) {
      printError(
        `Could not find the propose workflow's "ask the user" step in ${filePath} — skipping autoload patch. The file may have changed shape upstream.`,
      );
      continue;
    }

    const indent = match[1];
    const insertion = `${indent}${PROPOSE_STATE_AUTOLOAD_LINE}\n\n`;
    const patched = raw.slice(0, match.index) + insertion + raw.slice(match.index);
    fs.writeFileSync(filePath, patched, "utf-8");
  }
}

/**
 * Idempotently patches the generated `/opsx:propose` workflow file(s) so they know to analyze a
 * ticket's UI design reference (`state.yaml`'s `ui_design`) specifically when writing the
 * `proposal` artifact — see `PROPOSE_UI_DESIGN_LINE` for why this is a propose-specific patch
 * rather than a line in the generic `context:` pointer. Shares `addProposeStateAutoload()`'s
 * anchor (step 1's "ask the user" line) since both patches concern the same matched `state.yaml`;
 * each patch checks for its own text independently, so this runs regardless of whether the
 * autoload patch has already been applied.
 */
function addProposeUiDesignInstruction(repoRoot: string): void {
  for (const relPath of PROPOSE_WORKFLOW_FILES) {
    const filePath = path.join(repoRoot, relPath);
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, "utf-8");
    if (normalizeWhitespace(raw).includes(normalizeWhitespace(PROPOSE_UI_DESIGN_LINE))) {
      continue; // already patched
    }

    const match = raw.match(PROPOSE_ASK_USER_LINE_RE);
    if (!match || match.index === undefined) {
      printError(
        `Could not find the propose workflow's "ask the user" step in ${filePath} — skipping UI-design instruction patch. The file may have changed shape upstream.`,
      );
      continue;
    }

    const indent = match[1];
    const insertion = `${indent}${PROPOSE_UI_DESIGN_LINE}\n\n`;
    const patched = raw.slice(0, match.index) + insertion + raw.slice(match.index);
    fs.writeFileSync(filePath, patched, "utf-8");
  }
}

/**
 * Idempotently patches the generated `/opsx:propose` workflow file(s) so they know to read a
 * change's downloaded ticket attachments (`state.yaml`'s `attachments`) specifically when
 * writing the `proposal` artifact — see `PROPOSE_ATTACHMENT_LINE` for why this is a
 * propose-specific patch rather than a line in the generic `context:` pointer. Shares
 * `addProposeStateAutoload()`'s anchor (step 1's "ask the user" line), same as
 * `addProposeUiDesignInstruction()`; each patch checks for its own text independently, so this
 * runs regardless of whether the other patches have already been applied.
 */
function addProposeAttachmentInstruction(repoRoot: string): void {
  for (const relPath of PROPOSE_WORKFLOW_FILES) {
    const filePath = path.join(repoRoot, relPath);
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, "utf-8");
    if (normalizeWhitespace(raw).includes(normalizeWhitespace(PROPOSE_ATTACHMENT_LINE))) {
      continue; // already patched
    }

    const match = raw.match(PROPOSE_ASK_USER_LINE_RE);
    if (!match || match.index === undefined) {
      printError(
        `Could not find the propose workflow's "ask the user" step in ${filePath} — skipping attachment instruction patch. The file may have changed shape upstream.`,
      );
      continue;
    }

    const indent = match[1];
    const insertion = `${indent}${PROPOSE_ATTACHMENT_LINE}\n\n`;
    const patched = raw.slice(0, match.index) + insertion + raw.slice(match.index);
    fs.writeFileSync(filePath, patched, "utf-8");
  }
}

/**
 * Idempotently patches the generated `/opsx:propose` workflow file(s) so they read a sub-task's
 * parent ticket (`state.yaml`'s `parent` block) as background — not scope — specifically when
 * writing the `proposal` artifact; see `PROPOSE_PARENT_CONTEXT_LINE`. Same anchor and
 * independent idempotency check as `addProposeAttachmentInstruction()`.
 */
function addProposeParentContextInstruction(repoRoot: string): void {
  for (const relPath of PROPOSE_WORKFLOW_FILES) {
    const filePath = path.join(repoRoot, relPath);
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, "utf-8");
    if (normalizeWhitespace(raw).includes(normalizeWhitespace(PROPOSE_PARENT_CONTEXT_LINE))) {
      continue; // already patched
    }

    const match = raw.match(PROPOSE_ASK_USER_LINE_RE);
    if (!match || match.index === undefined) {
      printError(
        `Could not find the propose workflow's "ask the user" step in ${filePath} — skipping parent-context instruction patch. The file may have changed shape upstream.`,
      );
      continue;
    }

    const indent = match[1];
    const insertion = `${indent}${PROPOSE_PARENT_CONTEXT_LINE}\n\n`;
    const patched = raw.slice(0, match.index) + insertion + raw.slice(match.index);
    fs.writeFileSync(filePath, patched, "utf-8");
  }
}

// Matches the line that reports the OpenSpec change was created, in step 3 ("Create the change
// directory") of the generated `/opsx:propose` workflow — right after the `openspec new change`
// code block. The new instruction is inserted immediately after this line, at the same
// indentation, so it reads as the last thing that happens once the change actually exists.
const PROPOSE_CHANGE_CREATED_LINE_RE =
  /^( *)This creates a scaffolded change in the planning home resolved by the CLI with `\.openspec\.yaml`\.$/m;

/**
 * Idempotently patches the generated `/opsx:propose` workflow file(s) so they record the
 * OpenSpec change they just created against LV's own change context, by running `lv link
 * "<name>"` — see `PROPOSE_LINK_CHANGE_LINE`. Like `addProposeStateAutoload()`, this can't be
 * done via `openspec/config.yaml`'s `context:` pointer (only surfaced once an artifact's
 * `openspec instructions` is read, after the change is already created) and must be re-applied
 * by re-running `lv init` whenever `openspec update`/`openspec init --force` regenerates these
 * files from scratch.
 */
function addProposeLinkInstruction(repoRoot: string): void {
  for (const relPath of PROPOSE_WORKFLOW_FILES) {
    const filePath = path.join(repoRoot, relPath);
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, "utf-8");
    if (normalizeWhitespace(raw).includes(normalizeWhitespace(PROPOSE_LINK_CHANGE_LINE))) {
      continue; // already patched
    }

    const match = raw.match(PROPOSE_CHANGE_CREATED_LINE_RE);
    if (!match || match.index === undefined) {
      printError(
        `Could not find the propose workflow's "change created" step in ${filePath} — skipping link-instruction patch. The file may have changed shape upstream.`,
      );
      continue;
    }

    const indent = match[1];
    const insertAt = match.index + match[0].length;
    const insertion = `\n\n${indent}${PROPOSE_LINK_CHANGE_LINE}`;
    const patched = raw.slice(0, insertAt) + insertion + raw.slice(insertAt);
    fs.writeFileSync(filePath, patched, "utf-8");
  }
}

// The only generated apply-related file documented to honor a per-command model override via
// frontmatter — a Claude Code-specific mechanism. `.claude/skills/openspec-apply-change/SKILL.md`
// and `.agents/skills/openspec-apply-change/SKILL.md` have no equivalent, so they're not patched
// (see design.md Decision 2 of config-openspec-apply-llm-model).
const APPLY_COMMAND_RELATIVE_PATH = path.join(".claude", "commands", "opsx", "apply.md");

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n/;

/**
 * Idempotently sets or clears the `model` frontmatter field on the generated Claude Code
 * `/opsx:apply` command file from `.lv.yaml`'s `openspec.apply_model` — a Claude Code model
 * alias/id that pins which model executes that slash command, distinct from `models:`'s Mastra
 * "provider/model" strings used by LV's own agents. Unlike the `addPropose*Instruction()`
 * patches (anchor-regex text inserts into markdown body), this fully parses and re-dumps the
 * file's leading YAML frontmatter block, since it's a short, fully-generated block with no
 * hand-authored comments worth preserving. Because `openspec update`/`openspec init --force`
 * regenerates this file from scratch, re-run `lv init` afterward to re-apply the pin.
 */
function setApplyModelOverride(repoRoot: string, config: Config): void {
  const filePath = path.join(repoRoot, APPLY_COMMAND_RELATIVE_PATH);
  if (!fs.existsSync(filePath)) return; // tool not installed for this repo — nothing to patch

  const raw = fs.readFileSync(filePath, "utf-8");
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    printError(
      `Could not find a frontmatter block at the top of ${filePath} — skipping apply-model patch. The file may have changed shape upstream.`,
    );
    return;
  }

  const frontmatter = (yaml.load(match[1]) as Record<string, unknown>) ?? {};
  const desiredModel = config.openspec?.apply_model;

  if (desiredModel) {
    if (frontmatter.model === desiredModel) return; // already pinned to this value
    frontmatter.model = desiredModel;
  } else {
    if (!("model" in frontmatter)) return; // nothing to clear
    delete frontmatter.model;
  }

  const newFrontmatterBlock = `---\n${yaml.dump(frontmatter, { indent: 2 })}---\n`;
  const patched = newFrontmatterBlock + raw.slice(match[0].length);
  fs.writeFileSync(filePath, patched, "utf-8");
}

// Relative path OpenSpec writes a tool's own generated SKILL.md at, under that tool's base
// directory — universal across every tool `openspec init` supports (verified across seven
// tools, including wildly different ones like Gemini/Cline/Devin — see design.md's Context
// section), so this one relative path detects any tool OpenSpec installed, present or future,
// with no tool names hardcoded here.
const OPENSPEC_SKILL_MARKER_RELATIVE_PATH = path.join(
  "skills",
  "openspec-propose",
  "SKILL.md",
);

/**
 * Finds every coding-agent base directory `openspec init` installed a skill into for this repo.
 * OpenSpec always writes a tool's directory directly at the target repo root (never nested), so
 * checking each of the repo root's own subdirectories for `OPENSPEC_SKILL_MARKER_RELATIVE_PATH`
 * is enough — no recursive search of the whole tree, and no list of tool names to maintain. See
 * design.md Decision 3.
 */
function findOpenSpecToolBaseDirs(repoRoot: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(repoRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const marker = path.join(
      repoRoot,
      entry.name,
      OPENSPEC_SKILL_MARKER_RELATIVE_PATH,
    );
    if (fs.existsSync(marker)) found.push(entry.name);
  }
  return found;
}

interface LvBootstrapCommandShape {
  relativeCommandPath: string;
  build: () => string;
}

// The small, explicit set of coding-agent command-file formats `lv` knows how to author —
// deliberately not the same list as the tools the skill itself supports (that list is dynamic,
// see `findOpenSpecToolBaseDirs()`). A tool's base-dir name not listed here still gets the
// skill via `installLvBootstrapSkill()`, just no command file — the same way Codex already
// works with OpenSpec's own commands. Add a new entry here (not new detection logic) to support
// another tool's command shape later — see design.md Decision 3/4.
const LV_BOOTSTRAP_KNOWN_COMMAND_SHAPES: Record<string, LvBootstrapCommandShape> = {
  ".claude": {
    relativeCommandPath: path.join("commands", "lv", "bootstrap.md"),
    build: buildLvBootstrapClaudeCommandFile,
  },
  ".cursor": {
    relativeCommandPath: path.join("commands", "lv-bootstrap.md"),
    build: buildLvBootstrapCursorCommandFile,
  },
};

/**
 * Idempotently installs the `lv-bootstrap` skill — and, for a known command shape, a matching
 * slash command — into every coding-agent directory `openspec init` just installed a skill into,
 * detected dynamically via `findOpenSpecToolBaseDirs()` rather than a fixed list of tool names.
 * See design.md Decision 3/4 and the `lv-init/lv-bootstrap-skill-install` spec.
 */
function installLvBootstrapSkill(repoRoot: string): void {
  for (const toolDir of findOpenSpecToolBaseDirs(repoRoot)) {
    const skillPath = path.join(
      repoRoot,
      toolDir,
      "skills",
      "lv-bootstrap",
      "SKILL.md",
    );
    writeFile(skillPath, buildLvBootstrapSkillFile());

    const knownShape = LV_BOOTSTRAP_KNOWN_COMMAND_SHAPES[toolDir];
    if (!knownShape) continue;

    const commandPath = path.join(
      repoRoot,
      toolDir,
      knownShape.relativeCommandPath,
    );
    writeFile(commandPath, knownShape.build());
  }
}
