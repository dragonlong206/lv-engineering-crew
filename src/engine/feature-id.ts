import fs from 'fs';
import path from 'path';
import { getFeaturesDir } from '../config.js';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface ExistingFeature {
  id: string;
  overview: string;
}

/** Existing `Fxxxx` features with non-empty `overview.md` — match candidates for `lv start`. */
export function listExistingFeatures(
  repoRoot: string,
  prefix: string,
  digits: number,
): ExistingFeature[] {
  const featuresDir = getFeaturesDir(repoRoot);
  const pattern = new RegExp(`^${escapeRegExp(prefix)}(\\d{${digits}})$`);

  const features: ExistingFeature[] = [];
  if (!fs.existsSync(featuresDir)) return features;

  for (const entry of fs.readdirSync(featuresDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !pattern.test(entry.name)) continue;
    const overviewPath = path.join(featuresDir, entry.name, 'overview.md');
    if (!fs.existsSync(overviewPath)) continue;
    const overview = fs.readFileSync(overviewPath, 'utf-8').trim();
    if (!overview) continue;
    features.push({ id: entry.name, overview });
  }

  return features;
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
