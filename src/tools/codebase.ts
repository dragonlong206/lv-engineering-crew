import fs from 'fs';
import path from 'path';

export const DEFAULT_SKIP_DIRS = [
  'node_modules', '.git', 'dist', 'build', 'out',
  '__pycache__', '.venv',
  'bin', 'obj', '.vs', 'packages', // .NET/C#
  'target', 'vendor', '.idea',
];

export const DEFAULT_CODE_EXTENSIONS = [
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'py',
  'go',
  'java', 'kt',
  'rb',
  'rs',
  'cs', 'vb', 'cshtml', 'razor', 'csproj', 'sln', // .NET/C#/ASP.NET
  'php',
  'c', 'h', 'cpp', 'hpp', 'cc',
  'swift',
  'md', 'yaml', 'yml', 'json', 'xml', 'config', 'sql',
];

function buildExtRegex(extensions: string[]): RegExp {
  return new RegExp(`\\.(${extensions.join('|')})$`, 'i');
}

export function listCodeFiles(
  absDir: string,
  extensions: string[] = DEFAULT_CODE_EXTENSIONS,
  skipDirs: string[] = DEFAULT_SKIP_DIRS,
): string[] {
  const result: string[] = [];
  const skip = new Set(skipDirs);
  const codeExt = buildExtRegex(extensions);

  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (codeExt.test(entry.name)) {
        result.push(full);
      }
    }
  }

  walk(absDir);
  return result;
}
