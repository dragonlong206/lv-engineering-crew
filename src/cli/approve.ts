import { getRepoRoot } from '../config.js';
import { readState, writeState } from '../engine/state-io.js';
import { StateMachine } from '../engine/state-machine.js';
import { commitAll, currentBranch } from '../integrations/git/client.js';
import { printSuccess, printError } from './helpers.js';
import type { State } from '../types.js';

export async function runApprove(): Promise<void> {
  const repoRoot = getRepoRoot();

  const branch = await currentBranch(repoRoot);
  if (!branch.startsWith('lv/')) {
    printError("Not on an lv branch. Run 'lv start <ticket-id>' first.");
    process.exit(1);
  }
  const ticketId = branch.replace('lv/', '');

  const state = readState(repoRoot, ticketId);
  const machine = new StateMachine(state);

  const check = machine.canRun('approve');
  if (!check.ok) {
    printError(check.reason ?? 'Cannot approve now.');
    process.exit(1);
  }

  const currentStep = machine.currentStep();
  const stepRecord = state.steps[currentStep];

  if (!stepRecord) {
    printError(`No record found for step '${currentStep}'.`);
    process.exit(1);
  }

  const approvedAt = new Date().toISOString();

  const updatedState: State = {
    ...state,
    steps: {
      ...state.steps,
      [currentStep]: {
        ...stepRecord,
        status: 'approved' as const,
        approved_at: approvedAt,
      },
    },
  };

  writeState(repoRoot, updatedState);
  await commitAll(repoRoot, `lv: approve ${ticketId} ${currentStep}`);

  printSuccess(`Step '${currentStep}' approved.`);

  if (currentStep === 'analysis') {
    console.log(`\nNext: run 'lv design' to generate the design document.`);
  } else {
    console.log(`\nAll steps approved. You can now create a merge request.`);
  }
}
