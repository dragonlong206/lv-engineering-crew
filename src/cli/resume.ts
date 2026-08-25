import path from 'path';
import { loadConfig, getRepoRoot, getChangesDir } from '../config.js';
import { readState } from '../engine/state-io.js';
import { StateMachine } from '../engine/state-machine.js';
import { matchBranch, branchGlobs, renderBranchName } from '../engine/branch-naming.js';
import { checkoutBranch, currentBranch, listBranchesMatching } from '../integrations/git/client.js';
import { printInfo, printSuccess, printError, confirm, promptSelect } from './helpers.js';
import { runApprove } from './approve.js';
import { runDesign } from './design.js';

export async function runResume(ticketId?: string): Promise<void> {
  const config = loadConfig();
  const repoRoot = getRepoRoot();

  let resolvedTicketId: string;
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
    resolvedTicketId = ticketId;
  } else {
    const branch = await currentBranch(repoRoot);
    const matched = matchBranch(config, branch);
    if (matched) {
      resolvedTicketId = matched.ticketId;
    } else {
      const ticketBranches = await listBranchesMatching(repoRoot, branchGlobs(config));
      if (ticketBranches.length === 0) {
        printError("Not on a ticket branch and no ticket branches found. Run 'lv start <ticket-id>' first.");
        process.exit(1);
      }
      printInfo(`Current branch '${branch}' isn't a ticket branch.`);
      const chosen = await promptSelect('Which ticket do you want to resume?', ticketBranches);
      await checkoutBranch(repoRoot, chosen);
      resolvedTicketId = matchBranch(config, chosen)!.ticketId;
    }
  }

  const state = readState(repoRoot, resolvedTicketId);
  const machine = new StateMachine(state);
  const step = machine.currentStep();
  const record = state.steps[step];

  if (!record || record.status === 'pending') {
    printError(
      `Step '${step}' has no generated content yet — unexpected state. Check docs/changes/${resolvedTicketId}/state.yaml.`,
    );
    process.exit(1);
  }

  if (record.status === 'in_progress') {
    const docFile = step === 'analysis' ? '01-analysis.md' : '02-plan.md';
    printInfo(`Ticket ${resolvedTicketId} is waiting on you: step '${step}' is in progress.`);
    console.log(`  ${path.join(getChangesDir(repoRoot, resolvedTicketId), docFile)}`);

    const approved = await confirm(`\nApprove '${step}' now? [y/N] `);
    if (approved) {
      await runApprove();
    } else {
      console.log(`\nRun 'lv answer' to continue answering open questions, then 'lv resume' again.`);
    }
    return;
  }

  // record.status === 'approved'
  if (step === 'analysis') {
    printInfo(`Analysis is approved. Resuming: generating design document...`);
    await runDesign();
    return;
  }

  printSuccess(`Ticket ${resolvedTicketId} is fully approved.`);
  console.log(`\nAll steps approved. You can now create a merge request.`);
}
