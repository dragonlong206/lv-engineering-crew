import { loadConfig, getRepoRoot } from '../config.js';
import { addOpenspecChange } from '../engine/state-io.js';
import { matchBranch } from '../engine/branch-naming.js';
import { currentBranch } from '../integrations/git/client.js';
import { printError, printSuccess } from './helpers.js';

export async function runLink(openspecChangeName: string): Promise<void> {
  const config = loadConfig();
  const repoRoot = getRepoRoot();

  const branch = await currentBranch(repoRoot);
  const matched = matchBranch(config, branch);
  if (!matched) {
    printError('Not on a change branch.');
    process.exit(1);
  }
  const changeId = matched.ticketId;

  addOpenspecChange(repoRoot, changeId, openspecChangeName);
  printSuccess(`Linked OpenSpec change '${openspecChangeName}' to ${changeId}.`);
}
