import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { execa } from "execa";
import { getRepoRoot } from "../config.js";
import { printInfo, printSuccess, printError } from "./helpers.js";
import { CONTEXT_POINTER_LINES, ARCHIVE_GUIDANCE } from "../prompts.js";

export interface InitOptions {
  tool?: string;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export async function runInit(opts: InitOptions): Promise<void> {
  const repoRoot = getRepoRoot();

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
