import { loadConfig, getRepoRoot } from '../config.js';
import { readState } from '../engine/state-io.js';
import { matchBranch } from '../engine/branch-naming.js';
import { currentBranch } from '../integrations/git/client.js';
import { printError } from './helpers.js';
import type { State } from '../types.js';

export async function runStatus(): Promise<void> {
  const config = loadConfig();
  const repoRoot = getRepoRoot();

  const branch = await currentBranch(repoRoot);
  const matched = matchBranch(config, branch);
  if (!matched) {
    printError("Not on a change branch.");
    process.exit(1);
  }
  const changeId = matched.ticketId;

  const state = readState(repoRoot, changeId);
  printStateSummary(changeId, state);
}

/** Shared by `lv status` and `lv resume` — dumps a change's state.yaml context. */
export function printStateSummary(changeId: string, state: State): void {
  console.log('');
  console.log(`Change:      ${changeId}`);
  if (state.ticket_id) console.log(`Ticket:      ${state.ticket_id}`);
  console.log(`Title:       ${state.title}`);
  console.log(`Description: ${state.description || '(none)'}`);
  console.log(`Features:    ${state.feature_ids.length > 0 ? state.feature_ids.join(', ') : '(none)'}`);
  console.log(`Branch:      ${state.branch}`);
  console.log(`Created:     ${state.created_at}`);
  console.log(`Version:     ${state.lv_version}`);
  console.log('');
}
