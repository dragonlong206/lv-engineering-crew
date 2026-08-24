import path from 'path';
import { loadConfig, getRepoRoot, getChangesDir } from '../config.js';
import { readState, writeState } from '../engine/state-io.js';
import { StateMachine } from '../engine/state-machine.js';
import { commitAll } from '../integrations/git/client.js';
import { analysisAgent } from '../agents/analysis-agent.js';
import { designAgent } from '../agents/design-agent.js';
import { buildAnalysisUpdatePrompt, buildDesignUpdatePrompt } from '../prompts.js';
import { printInfo, printSuccess, printError, openEditor, writeFile, extractText, extractUsage } from './helpers.js';
import { getModelForStep } from '../config.js';
import type { State } from '../types.js';

export async function runAnswer(): Promise<void> {
  const config = loadConfig();
  const repoRoot = getRepoRoot();

  // Find the current ticket from branch name
  const ticketId = await getCurrentTicketId(repoRoot);
  if (!ticketId) {
    printError("Not on an lv branch. Run 'lv start <ticket-id>' first.");
    process.exit(1);
  }

  const state = readState(repoRoot, ticketId);
  const machine = new StateMachine(state);

  const check = machine.canRun('answer');
  if (!check.ok) {
    printError(check.reason ?? 'Cannot run answer now.');
    process.exit(1);
  }

  const currentStep = machine.currentStep();
  const changesDir = getChangesDir(repoRoot, ticketId);
  const docFile = currentStep === 'analysis'
    ? path.join(changesDir, '01-analysis.md')
    : path.join(changesDir, '02-design.md');

  printInfo(`Opening ${path.basename(docFile)} for editing...`);
  openEditor(docFile);

  printInfo('Updating document based on your changes...');
  const threadId = `${ticketId}-${currentStep}`;

  const prompt = currentStep === 'analysis'
    ? buildAnalysisUpdatePrompt(ticketId, docFile, '01-analysis.md')
    : buildDesignUpdatePrompt(ticketId, docFile);

  const agent = currentStep === 'analysis' ? analysisAgent : designAgent;
  const stepModel = getModelForStep(config, currentStep);

  const startTime = Date.now();
  const result = await agent.generate(prompt, {
    memory: { thread: threadId, resource: ticketId },
    model: stepModel,
  });
  const durationSeconds = (Date.now() - startTime) / 1000;

  const updatedContent = extractText(result);
  const usage = extractUsage(result);

  writeFile(docFile, updatedContent);

  const stepRecord = state.steps[currentStep] ?? {
    status: 'in_progress' as const,
    iterations: 0,
    model: stepModel,
    tokens_in: 0,
    tokens_out: 0,
    duration_seconds: 0,
  };
  const updatedStepRecord = {
    ...stepRecord,
    status: 'in_progress' as const,
    iterations: stepRecord.iterations + 1,
    model: stepModel,
    tokens_in: stepRecord.tokens_in + usage.tokensIn,
    tokens_out: stepRecord.tokens_out + usage.tokensOut,
    duration_seconds: stepRecord.duration_seconds + durationSeconds,
  };
  const updatedSteps = currentStep === 'analysis'
    ? { ...state.steps, analysis: updatedStepRecord }
    : { ...state.steps, design: updatedStepRecord };
  const updatedState: State = { ...state, steps: updatedSteps };

  writeState(repoRoot, updatedState);
  await commitAll(repoRoot, `lv: answer ${ticketId} ${currentStep} iteration ${updatedStepRecord.iterations}`);

  printSuccess(`Document updated. Iteration ${updatedStepRecord.iterations}.`);
  console.log(`\nReview ${path.basename(docFile)} and run 'lv answer' again or 'lv approve'.`);
}

async function getCurrentTicketId(repoRoot: string): Promise<string | null> {
  const { currentBranch } = await import('../integrations/git/client.js');
  const branch = await currentBranch(repoRoot);
  if (!branch.startsWith('lv/')) return null;
  return branch.replace('lv/', '');
}
