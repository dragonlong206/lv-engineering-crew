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

/** Idempotently records an OpenSpec change name against a change's persisted state. */
export function addOpenspecChange(repoRoot: string, changeId: string, openspecChangeName: string): void {
  const state = readState(repoRoot, changeId);
  if (state.openspec_changes.includes(openspecChangeName)) return;
  state.openspec_changes = [...state.openspec_changes, openspecChangeName];
  writeState(repoRoot, changeId, state);
}

/** Idempotently records that a feature's docs were refreshed on this change's branch. */
export function markFeatureRefreshed(repoRoot: string, changeId: string, featureId: string): void {
  const state = readState(repoRoot, changeId);
  const refreshed = state.refreshed_features ?? [];
  if (refreshed.includes(featureId)) return;
  state.refreshed_features = [...refreshed, featureId];
  writeState(repoRoot, changeId, state);
}
