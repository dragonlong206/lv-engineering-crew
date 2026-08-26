import { loadConfig, getRepoRoot } from '../config.js';
import { readState } from '../engine/state-io.js';
import { matchBranch, branchGlobs, renderBranchName } from '../engine/branch-naming.js';
import { checkoutBranch, currentBranch, listBranchesMatching } from '../integrations/git/client.js';
import { printInfo, printSuccess, printError, promptSelect } from './helpers.js';
import { printStateSummary } from './status.js';

export async function runResume(ticketId?: string): Promise<void> {
  const config = loadConfig();
  const repoRoot = getRepoRoot();

  let resolvedChangeId: string;
  if (ticketId) {
    const candidates = (await listBranchesMatching(repoRoot, branchGlobs(config))).filter(
      (b) => matchBranch(config, b)?.ticketId === ticketId,
    );

    let branchName: string;
    if (candidates.length === 1) {
      branchName = candidates[0];
    } else if (candidates.length > 1) {
      branchName = await promptSelect(`Multiple branches found for ticket '${ticketId}'. Which one?`, candidates);
    } else {
      // No existing branch — fall back to the default type's naming, same as `lv start` would create.
      branchName = renderBranchName(config, ticketId);
    }

    printInfo(`Checking out ${branchName}...`);
    await checkoutBranch(repoRoot, branchName);
    resolvedChangeId = ticketId;
  } else {
    const branch = await currentBranch(repoRoot);
    const matched = matchBranch(config, branch);
    if (matched) {
      resolvedChangeId = matched.ticketId;
    } else {
      const ticketBranches = await listBranchesMatching(repoRoot, branchGlobs(config));
      if (ticketBranches.length === 0) {
        printError("Not on a change branch and no change branches found. Run 'lv start' first.");
        process.exit(1);
      }
      printInfo(`Current branch '${branch}' isn't a change branch.`);
      const chosen = await promptSelect('Which change do you want to resume?', ticketBranches);
      await checkoutBranch(repoRoot, chosen);
      resolvedChangeId = matchBranch(config, chosen)!.ticketId;
    }
  }

  const state = readState(repoRoot, resolvedChangeId);
  printSuccess(`Resumed ${resolvedChangeId}`);
  printStateSummary(resolvedChangeId, state);
  console.log(`\nContinue with your coding agent's OpenSpec workflow (e.g. /opsx:propose or /opsx:apply).`);
}
