import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { execa } from "execa";
import { getRepoRoot } from "../config.js";
import { printInfo, printSuccess, printError } from "./helpers.js";

export interface InitOptions {
  tool?: string;
}

// Multi-line so it renders as a YAML block scalar (`context: |`) — kept short and generic
// enough to apply to every change, so `lv start` never has to rewrite it per-change.
const CONTEXT_POINTER = [
  "LV Crew context: before proposing, designing, or implementing anything, read:",
  "- the feature docs under `docs/features/<feature-id>/{overview.md,design.md}` for any feature IDs this change touches",
  "- the current change's ticket/description context in `docs/changes/<change-id>/state.yaml` (the directory matching the current git branch)",
].join("\n");

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

  printSuccess("OpenSpec installed and wired to LV context.");
  console.log(`\nNext: run 'lv start <ticket-id>' or 'lv start --description "..."' to begin a change.`);
}

/**
 * Idempotently wires OpenSpec's project-wide `context:` (openspec/config.yaml) to point at
 * LV's feature docs and per-change state.yaml, so OpenSpec's explore/propose/apply workflows
 * load them automatically instead of the engineer pasting them into every prompt.
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
  if (normalizeWhitespace(raw).includes(normalizeWhitespace(CONTEXT_POINTER))) return; // already wired

  const hasActiveContextKey = /^context:/m.test(raw);

  if (!hasActiveContextKey) {
    // Fresh template — `context:` only appears commented out. Append a new top-level key
    // instead of round-tripping through js-yaml, so the template's explanatory comments
    // stay intact.
    const block = `\ncontext: |\n${CONTEXT_POINTER.split("\n")
      .map((line) => `  ${line}`)
      .join("\n")}\n`;
    fs.appendFileSync(configPath, block, "utf-8");
    return;
  }

  // An engineer already customized `context:` — merge properly via YAML instead of a blind
  // text append, at the cost of losing this file's comments on this one rewrite.
  const parsed = (yaml.load(raw) as Record<string, unknown>) ?? {};
  const existing = typeof parsed.context === "string" ? parsed.context : "";
  parsed.context = existing ? `${existing}\n\n${CONTEXT_POINTER}` : CONTEXT_POINTER;
  fs.writeFileSync(configPath, yaml.dump(parsed, { indent: 2 }), "utf-8");
}
