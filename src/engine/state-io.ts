import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { StateSchema, type State } from '../types.js';
import { getChangesDir } from '../config.js';

export function readState(repoRoot: string, ticketId: string): State {
  const stateFile = path.join(getChangesDir(repoRoot, ticketId), 'state.yaml');
  if (!fs.existsSync(stateFile)) {
    throw new Error(`No state found for ticket ${ticketId}. Run 'lv start ${ticketId}' first.`);
  }
  const raw = yaml.load(fs.readFileSync(stateFile, 'utf-8'));
  return StateSchema.parse(raw);
}

export function writeState(repoRoot: string, state: State): void {
  const dir = getChangesDir(repoRoot, state.ticket_id);
  fs.mkdirSync(dir, { recursive: true });
  const stateFile = path.join(dir, 'state.yaml');
  fs.writeFileSync(stateFile, yaml.dump(state, { indent: 2 }), 'utf-8');
}

export function stateExists(repoRoot: string, ticketId: string): boolean {
  return fs.existsSync(path.join(getChangesDir(repoRoot, ticketId), 'state.yaml'));
}
