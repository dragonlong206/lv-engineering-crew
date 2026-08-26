import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { execa } from "execa";
import { getRepoRoot } from "../config.js";
import { printInfo, printSuccess, printError, confirm } from "./helpers.js";
import {
  CONTEXT_POINTER_LINES,
  ARCHIVE_GUIDANCE,
  PROPOSE_STATE_AUTOLOAD_LINE,
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

/** Resolves `false` only for "executable not found" (ENOENT); any other failure re-throws. */
async function isOpenSpecInstalled(): Promise<boolean> {
  try {
    await execa("openspec", ["--version"]);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
}

export async function runInit(opts: InitOptions): Promise<void> {
  const repoRoot = getRepoRoot();

  if (!(await isOpenSpecInstalled())) {
    const proceed = await confirm(
      `OpenSpec CLI not found. Install ${OPENSPEC_PACKAGE} globally now? (y/N) `,
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
    await execa("openspec", args, { cwd: repoRoot, stdio: "inherit" });
  } catch (err) {
    printError(`OpenSpec install failed: ${(err as Error).message}`);
    process.exit(1);
  }

  addContextPointer(repoRoot);
  addArchiveGuidance(repoRoot);
  addProposeStateAutoload(repoRoot);

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

  const raw = fs.readFileSync(configPath, "utf-8");
  // Compare with whitespace collapsed — YAML re-wrapping/indentation (block literal on a
  // fresh append vs. re-flowed by js-yaml's dump on a merge) must not defeat this check.
  const normalizedRaw = normalizeWhitespace(raw);
  const missingLines = CONTEXT_POINTER_LINES.filter(
    (line) => !normalizedRaw.includes(normalizeWhitespace(line)),
  );
  if (missingLines.length === 0) return; // already fully wired

  const addition = missingLines.join("\n");
  const hasActiveContextKey = /^context:/m.test(raw);

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

/**
 * Idempotently wires OpenSpec's `operations.archive.guidance` (openspec/config.yaml) so the
 * generated archive workflow is told to refresh feature docs for the archiving change before
 * completing — read via `openspec instructions archive --change <name> --json`'s
 * `operationGuidance` field, which the generated `/opsx:archive` workflow already reads and
 * follows advisorily (never blocking the archive if ignored).
 */
function addArchiveGuidance(repoRoot: string): void {
  const configPath = path.join(repoRoot, "openspec", "config.yaml");
  if (!fs.existsSync(configPath)) {
    printError(`Expected OpenSpec config at ${configPath} after install — not found.`);
    return;
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  if (normalizeWhitespace(raw).includes(normalizeWhitespace(ARCHIVE_GUIDANCE))) return; // already wired

  const hasActiveOperationsKey = /^operations:/m.test(raw);

  if (!hasActiveOperationsKey) {
    // Fresh template — `operations:` only appears commented out. Append a new top-level key
    // instead of round-tripping through js-yaml, so the template's explanatory comments
    // stay intact.
    const block = `\noperations:\n  archive:\n    guidance:\n      - ${ARCHIVE_GUIDANCE}\n`;
    fs.appendFileSync(configPath, block, "utf-8");
    return;
  }

  // An engineer already customized `operations:` (e.g. `apply:` guidance with no `archive:`
  // key, or an `archive:` key with no `guidance:` list yet) — merge via YAML instead of a
  // blind text append, building the missing intermediate keys as needed, at the cost of
  // losing this file's comments on this one rewrite.
  const parsed = (yaml.load(raw) as Record<string, unknown>) ?? {};
  const operations = (parsed.operations as Record<string, unknown>) ?? {};
  const archive = (operations.archive as Record<string, unknown>) ?? {};
  const guidance = Array.isArray(archive.guidance) ? (archive.guidance as string[]) : [];

  if (!guidance.some((entry) => normalizeWhitespace(String(entry)) === normalizeWhitespace(ARCHIVE_GUIDANCE))) {
    guidance.push(ARCHIVE_GUIDANCE);
  }

  archive.guidance = guidance;
  operations.archive = archive;
  parsed.operations = operations;

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
