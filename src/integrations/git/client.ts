import { execa } from 'execa';
import path from 'path';

async function git(args: string[], cwd: string): Promise<string> {
  const result = await execa('git', args, { cwd, reject: true });
  return result.stdout;
}

export async function getDefaultBranch(repoRoot: string, configured: string): Promise<string> {
  try {
    const symbolic = await git(['symbolic-ref', 'refs/remotes/origin/HEAD'], repoRoot);
    return symbolic.trim().replace('refs/remotes/origin/', '');
  } catch {
    return configured;
  }
}

export async function createBranch(repoRoot: string, branchName: string, fromBranch: string): Promise<void> {
  await git(['checkout', fromBranch], repoRoot);
  await git(['pull', '--ff-only'], repoRoot).catch(() => {});
  await git(['checkout', '-b', branchName], repoRoot);
}

export async function stageAll(repoRoot: string): Promise<void> {
  await git(['add', '-A'], repoRoot);
}

export async function commitAll(repoRoot: string, message: string): Promise<void> {
  await stageAll(repoRoot);
  const status = await git(['status', '--porcelain'], repoRoot);
  if (!status.trim()) return; // nothing to commit
  await git(['commit', '-m', message], repoRoot);
}

export async function push(repoRoot: string, branchName: string): Promise<void> {
  await git(['push', '--set-upstream', 'origin', branchName], repoRoot);
}

export async function currentBranch(repoRoot: string): Promise<string> {
  return (await git(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot)).trim();
}

export async function getRecentLog(repoRoot: string, dirPath: string, sinceDays: number): Promise<string> {
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);
  const isoDate = since.toISOString().split('T')[0];

  const relPath = path.relative(repoRoot, dirPath);

  try {
    const log = await git(
      ['log', `--since=${isoDate}`, '--oneline', '--follow', '--', relPath],
      repoRoot,
    );
    if (!log.trim()) return '';

    const hashes = log
      .trim()
      .split('\n')
      .slice(0, 5)
      .map((l) => l.split(' ')[0]);

    const diffs = await Promise.all(
      hashes.map((hash) =>
        git(['show', '--stat', hash], repoRoot).catch(() => ''),
      ),
    );

    return diffs.join('\n---\n');
  } catch {
    return '';
  }
}
