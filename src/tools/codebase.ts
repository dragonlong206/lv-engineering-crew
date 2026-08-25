import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '__pycache__', '.venv']);
const CODE_EXT = /\.(ts|js|py|go|java|rb|rs|md|yaml|yml|json)$/;
const MAX_FILE_CHARS = 20000;
const MAX_SEARCH_RESULTS = 30;

export function listCodeFiles(absDir: string): string[] {
  const result: string[] = [];

  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (CODE_EXT.test(entry.name)) {
        result.push(full);
      }
    }
  }

  walk(absDir);
  return result;
}

export const listFilesTool = createTool({
  id: 'listFiles',
  description:
    'List code/doc files under a directory in the repo (relative to repoRoot), skipping node_modules/.git/dist/etc.',
  inputSchema: z.object({
    repoRoot: z.string().describe('Absolute path to the git repository root'),
    dir: z.string().optional().describe('Directory relative to repoRoot to list (default: repo root)'),
  }),
  execute: async ({ repoRoot, dir }) => {
    const absDir = dir ? path.join(repoRoot, dir) : repoRoot;
    if (!fs.existsSync(absDir)) return { files: [] };
    const files = listCodeFiles(absDir).map((f) => path.relative(repoRoot, f));
    return { files };
  },
});

export const readFileTool = createTool({
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

export const searchCodeTool = createTool({
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
    outer: for (const absFile of listCodeFiles(repoRoot)) {
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
