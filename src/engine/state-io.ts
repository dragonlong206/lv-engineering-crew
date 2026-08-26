import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { StateSchema, type State } from '../types.js';
import { getChangesDir } from '../config.js';

export function readState(repoRoot: string, changeId: string): State {
  const stateFile = path.join(getChangesDir(repoRoot, changeId), 'state.yaml');
  if (!fs.existsSync(stateFile)) {
    throw new Error(`No state found for change ${changeId}. Run 'lv start' first.`);
  }
  const raw = yaml.load(fs.readFileSync(stateFile, 'utf-8'));
  return StateSchema.parse(raw);
}

export function writeState(repoRoot: string, changeId: string, state: State): void {
  const dir = getChangesDir(repoRoot, changeId);
  fs.mkdirSync(dir, { recursive: true });
  const stateFile = path.join(dir, 'state.yaml');
  fs.writeFileSync(stateFile, yaml.dump(state, { indent: 2 }), 'utf-8');
}

export function stateExists(repoRoot: string, changeId: string): boolean {
  return fs.existsSync(path.join(getChangesDir(repoRoot, changeId), 'state.yaml'));
}
