import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
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

const MAX_FILE_CHARS = 20000;
const MAX_SEARCH_RESULTS = 30;

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

export function buildCodebaseTools(extensions?: string[], skipDirs?: string[]) {
  const exts = extensions ?? DEFAULT_CODE_EXTENSIONS;
  const skips = skipDirs ?? DEFAULT_SKIP_DIRS;

  const listFilesTool = createTool({
    id: 'listFiles',
    description:
      'List code/doc files under a directory in the repo (relative to repoRoot), skipping build/dependency directories.',
    inputSchema: z.object({
      repoRoot: z.string().describe('Absolute path to the git repository root'),
      dir: z.string().optional().describe('Directory relative to repoRoot to list (default: repo root)'),
    }),
    execute: async ({ repoRoot, dir }) => {
      const absDir = dir ? path.join(repoRoot, dir) : repoRoot;
      if (!fs.existsSync(absDir)) return { files: [] };
      const files = listCodeFiles(absDir, exts, skips).map((f) => path.relative(repoRoot, f));
      return { files };
    },
  });

  const readFileTool = createTool({
    id: 'readFile',
    description: 'Read the contents of a single file (relative to repoRoot), truncated if very large',
    inputSchema: z.object({
      repoRoot: z.string().describe('Absolute path to the git repository root'),
      filePath: z.string().describe('File path relative to repoRoot'),
    }),
    execute: async ({ repoRoot, filePath }) => {
      const absPath = path.join(repoRoot, filePath);
      if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
        return { content: '', exists: false, truncated: false };
      }
      const content = fs.readFileSync(absPath, 'utf-8');
      const truncated = content.length > MAX_FILE_CHARS;
      return {
        content: truncated ? content.slice(0, MAX_FILE_CHARS) : content,
        exists: true,
        truncated,
      };
    },
  });

  const searchCodeTool = createTool({
    id: 'searchCode',
    description:
      'Search code/doc files under the repo for a keyword or regex pattern, returning matching file paths and line snippets',
    inputSchema: z.object({
      repoRoot: z.string().describe('Absolute path to the git repository root'),
      pattern: z.string().describe('Keyword or regex pattern to search for'),
    }),
    execute: async ({ repoRoot, pattern }) => {
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, 'i');
      } catch {
        regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      }

      const matches: { file: string; line: number; snippet: string }[] = [];
      outer: for (const absFile of listCodeFiles(repoRoot, exts, skips)) {
        const lines = fs.readFileSync(absFile, 'utf-8').split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            matches.push({ file: path.relative(repoRoot, absFile), line: i + 1, snippet: lines[i].trim() });
            if (matches.length >= MAX_SEARCH_RESULTS) break outer;
          }
        }
      }
      return { matches };
    },
  });

  return { listFilesTool, readFileTool, searchCodeTool };
}
