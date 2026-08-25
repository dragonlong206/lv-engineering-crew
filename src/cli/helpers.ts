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

export function extractJson<T>(text: string): T {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json|markdown)?\s*([\s\S]*?)\s*```$/);
  const jsonStr = fenceMatch ? fenceMatch[1] : trimmed;
  return JSON.parse(jsonStr) as T;
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
