import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { ConfigSchema, type Config, type Step } from './types.js';


function findRepoRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.lv.yaml'))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error('.lv.yaml not found. Run lv from inside a repo with a .lv.yaml config file.');
}

function readYamlFile(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  return (yaml.load(content) as Record<string, unknown>) ?? {};
}

export function loadConfig(): Config {
  const repoRoot = findRepoRoot(process.cwd());

  const repoConfig = readYamlFile(path.join(repoRoot, '.lv.yaml'));
  const localConfig = readYamlFile(path.join(repoRoot, '.lv.local.yaml'));

  // Env vars (uppercased key) take priority over local file values.
  const envOverrides = Object.fromEntries(
    Object.keys(localConfig)
      .filter((k) => process.env[k.toUpperCase()] !== undefined)
      .map((k) => [k, process.env[k.toUpperCase()]]),
  );

  const merged = { ...repoConfig, ...localConfig, ...envOverrides };

  const result = ConfigSchema.safeParse(merged);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Config invalid — missing or wrong fields: ${missing}`);
  }

  // Bridge string config values into process.env (uppercase key) so Mastra and
  // other SDKs can find them. Convention: yaml key = env var name lowercased.
  for (const [key, value] of Object.entries(result.data)) {
    const envKey = key.toUpperCase();
    if (typeof value === 'string' && !process.env[envKey]) process.env[envKey] = value;
  }

  return result.data;
}

export function getRepoRoot(): string {
  return findRepoRoot(process.cwd());
}

export function getChangesDir(repoRoot: string, ticketId: string): string {
  return path.join(repoRoot, 'docs', 'changes', ticketId);
}

export function getFeaturesDir(repoRoot: string): string {
  return path.join(repoRoot, 'docs', 'features');
}

export function getFeatureDir(repoRoot: string, featureId: string): string {
  return path.join(repoRoot, 'docs', 'features', featureId);
}

export function getModelForStep(config: Config, step: Step | 'bootstrap'): string {
  return config.models?.[step] ?? config.model;
}
