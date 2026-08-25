import fs from 'fs';
import { getFeaturesDir } from '../config.js';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function allocateFeatureIds(
  repoRoot: string,
  count: number,
  prefix: string,
  digits: number,
): string[] {
  const featuresDir = getFeaturesDir(repoRoot);
  const pattern = new RegExp(`^${escapeRegExp(prefix)}(\\d{${digits}})$`);

  let max = 0;
  if (fs.existsSync(featuresDir)) {
    for (const entry of fs.readdirSync(featuresDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const match = entry.name.match(pattern);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > max) max = n;
      }
    }
  }

  const ids: string[] = [];
  for (let i = 1; i <= count; i++) {
    ids.push(`${prefix}${String(max + i).padStart(digits, '0')}`);
  }
  return ids;
}
