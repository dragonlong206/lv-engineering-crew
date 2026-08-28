import { execa } from 'execa';

async function openspec(args: string[], cwd: string): Promise<string> {
  const result = await execa('openspec', args, { cwd, reject: true });
  return result.stdout;
}

export interface OpenspecChangeStatus {
  isComplete: boolean;
  nextSteps: string[];
}

export interface OpenspecApplyProgress {
  total: number;
  complete: number;
  remaining: number;
}

export async function getChangeStatus(repoRoot: string, name: string): Promise<OpenspecChangeStatus> {
  const stdout = await openspec(['status', '--change', name, '--json'], repoRoot);
  const parsed = JSON.parse(stdout) as { isComplete?: boolean; nextSteps?: string[]; status?: unknown };
  if (typeof parsed.isComplete !== 'boolean') {
    throw new Error(`Unexpected 'openspec status' output for change '${name}'.`);
  }
  return { isComplete: parsed.isComplete, nextSteps: parsed.nextSteps ?? [] };
}

export async function getApplyProgress(repoRoot: string, name: string): Promise<OpenspecApplyProgress> {
  const stdout = await openspec(['instructions', 'apply', '--change', name, '--json'], repoRoot);
  const parsed = JSON.parse(stdout) as { progress?: OpenspecApplyProgress };
  if (!parsed.progress) {
    throw new Error(`Unexpected 'openspec instructions apply' output for change '${name}'.`);
  }
  return parsed.progress;
}
