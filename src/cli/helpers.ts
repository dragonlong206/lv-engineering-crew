import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'node:readline/promises';
import chalk from 'chalk';

export async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

export async function promptSelect(question: string, options: string[]): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(question);
  options.forEach((opt, i) => console.log(`  ${i + 1}) ${opt}`));

  let choice = NaN;
  while (!(choice >= 1 && choice <= options.length)) {
    const answer = await rl.question(`Select 1-${options.length}: `);
    choice = Number(answer.trim());
  }
  rl.close();
  return options[choice - 1];
}

/**
 * Prints a numbered list of items and lets the engineer accept them as-is (Enter) or replace
 * the selection by typing a reply, parsed by `parseReplacement` into the kept item set. Shared
 * by `confirmFeatureSplit()` (replace with arbitrary new titles) and the existing-feature match
 * confirmation (narrow to a subset of the shown candidates, or none).
 */
export async function confirmSelection<T>(
  items: T[],
  opts: {
    header: string;
    formatLabel: (item: T, index: number) => string;
    promptText: string;
    parseReplacement: (raw: string, items: T[]) => T[];
  },
): Promise<T[]> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(opts.header);
  items.forEach((item, i) => console.log(`  ${i + 1}) ${opts.formatLabel(item, i)}`));

  const answer = await rl.question(opts.promptText);
  rl.close();

  const trimmed = answer.trim();
  if (trimmed.length === 0) return items;

  return opts.parseReplacement(trimmed, items);
}

/**
 * Prints the inferred new-feature titles and lets the engineer accept them as-is (Enter) or
 * replace the whole list with a comma-separated set of titles. Returns the confirmed titles —
 * never empty: a blank or all-commas reply falls back to the inferred list rather than
 * allocating zero features.
 */
export async function confirmFeatureSplit(
  inferred: { title: string }[],
): Promise<string[]> {
  const selected = await confirmSelection(inferred, {
    header:
      inferred.length > 1
        ? `This looks like it introduces ${inferred.length} features:`
        : `This looks like it introduces 1 feature:`,
    formatLabel: (f) => f.title,
    promptText: `Press Enter to accept, or type a comma-separated list of titles to replace it: `,
    parseReplacement: (raw) => {
      const replaced = raw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      return replaced.length > 0 ? replaced.map((title) => ({ title })) : inferred;
    },
  });

  return selected.map((f) => f.title);
}

/**
 * Asks the engineer whether to resume or restart a change whose branch already exists —
 * separate from a generic confirm()/promptSelect() so the destructive nature of restart
 * (discarding the branch's local history) is stated up front rather than folded into a
 * generic yes/no.
 */
export async function promptResumeOrRestart(branchName: string): Promise<'resume' | 'restart'> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(`Branch '${branchName}' already exists for this change.`);
  console.log(`  1) Resume — check out the existing branch and continue`);
  console.log(`  2) Restart — discard the branch's local history and start over`);

  let choice = NaN;
  while (choice !== 1 && choice !== 2) {
    const answer = await rl.question(`Select 1-2: `);
    choice = Number(answer.trim());
  }
  rl.close();
  return choice === 1 ? 'resume' : 'restart';
}

export function openEditor(filePath: string): void {
  const editor =
    process.env['EDITOR'] ??
    process.env['VISUAL'] ??
    (process.platform === 'win32' ? 'notepad' : 'vi');

  execSync(`${editor} "${filePath}"`, { stdio: 'inherit' });
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function writeFile(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function extractText(result: { text: string }): string {
  return result.text ?? '';
}

/**
 * `extractJson()` throws this (instead of letting a bare `JSON.parse` `SyntaxError` escape) so
 * callers and the final CLI error both have a snippet of what the model actually said to show
 * the engineer.
 */
export class JsonExtractionError extends Error {
  constructor(public readonly snippet: string, cause: unknown) {
    super(`Response did not contain valid JSON. Model responded with: "${snippet}"`, { cause });
    this.name = 'JsonExtractionError';
  }
}

export function extractJson<T>(text: string): T {
  const trimmed = text.trim();
  const snippet = trimmed.length > 200 ? `${trimmed.slice(0, 200)}...` : trimmed;
  const fenceMatch = trimmed.match(/^```(?:json|markdown)?\s*([\s\S]*?)\s*```$/);
  const candidate = fenceMatch ? fenceMatch[1] : trimmed;

  // Models occasionally append stray characters (e.g. an extra closing brace) after an
  // otherwise-valid JSON object. Parse only the balanced top-level {...} region instead of
  // trusting the whole string, so trailing garbage doesn't break JSON.parse.
  const start = candidate.indexOf('{');
  if (start === -1) {
    try {
      return JSON.parse(candidate) as T;
    } catch (err) {
      throw new JsonExtractionError(snippet, err);
    }
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  const jsonStr = end !== -1 ? candidate.slice(start, end + 1) : candidate;
  try {
    return JSON.parse(jsonStr) as T;
  } catch (err) {
    throw new JsonExtractionError(snippet, err);
  }
}

export function extractUsage(result: {
  totalUsage?: { inputTokens?: number; outputTokens?: number };
  usage?: { inputTokens?: number; outputTokens?: number };
}): { tokensIn: number; tokensOut: number } {
  const u = result.totalUsage ?? result.usage;
  return {
    tokensIn: u?.inputTokens ?? 0,
    tokensOut: u?.outputTokens ?? 0,
  };
}

export function printSuccess(msg: string): void {
  console.log(chalk.green('✓'), msg);
}

export function printInfo(msg: string): void {
  console.log(chalk.blue('→'), msg);
}

export function printError(msg: string): void {
  console.error(chalk.red('✗'), msg);
}

export function printWarn(msg: string): void {
  console.warn(chalk.yellow('!'), msg);
}

export function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}
