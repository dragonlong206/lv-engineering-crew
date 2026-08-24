import { getRepoRoot } from '../config.js';
import { readState } from '../engine/state-io.js';
import { currentBranch } from '../integrations/git/client.js';
import { printError } from './helpers.js';
import type { StepRecord } from '../types.js';

export async function runStatus(): Promise<void> {
  const repoRoot = getRepoRoot();

  const branch = await currentBranch(repoRoot);
  if (!branch.startsWith('lv/')) {
    printError("Not on an lv branch.");
    process.exit(1);
  }
  const ticketId = branch.replace('lv/', '');

  const state = readState(repoRoot, ticketId);

  console.log('');
  console.log(`Ticket:    ${state.ticket_id}`);
  console.log(`Features:  ${state.feature_ids.join(', ')}`);
  console.log(`Branch:    ${state.branch}`);
  console.log(`Step:      ${state.current_step}`);
  console.log(`Created:   ${state.created_at}`);
  console.log(`Version:   ${state.lv_version}`);
  console.log('');
  console.log('Steps:');

  function printStep(step: string, record: StepRecord | undefined): void {
    if (!record) {
      console.log(`  ${step.padEnd(10)} —`);
      return;
    }
    const totalTokens = record.tokens_in + record.tokens_out;
    const approved = record.approved_at ? ` (approved ${record.approved_at})` : '';
    console.log(
      `  ${step.padEnd(10)} ${record.status.padEnd(12)} ` +
        `iter=${record.iterations}  tokens=${totalTokens.toLocaleString()}  ` +
        `${record.duration_seconds.toFixed(1)}s  model=${record.model}${approved}`,
    );
  }

  printStep('analysis', state.steps.analysis);
  printStep('design', state.steps.design);
  console.log('');
}
