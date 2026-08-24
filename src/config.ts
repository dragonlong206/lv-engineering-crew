import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import os from 'os';
import { ConfigSchema, type Config } from './types.js';

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
  const userConfigPath = path.join(os.homedir(), '.config', 'lv', 'config.yaml');
  const userConfig = readYamlFile(userConfigPath);

  const merged = {
    ...userConfig,
    ...repoConfig,
    lark_token: process.env['LARK_TOKEN'] ?? userConfig['lark_token'],
    anthropic_api_key: process.env['ANTHROPIC_API_KEY'] ?? userConfig['anthropic_api_key'],
  };

  const result = ConfigSchema.safeParse(merged);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Config invalid — missing or wrong fields: ${missing}`);
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
