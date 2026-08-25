import fs from 'fs';
import path from 'path';
import { loadConfig, getRepoRoot, getChangesDir } from '../config.js';
import { readState, writeState } from '../engine/state-io.js';
import { StateMachine } from '../engine/state-machine.js';
import { matchBranch } from '../engine/branch-naming.js';
import { commitAll } from '../integrations/git/client.js';
import { analysisAgent } from '../agents/analysis-agent.js';
import { designAgent } from '../agents/design-agent.js';
import { buildAnalysisUpdatePrompt, buildDesignUpdatePrompt, type DesignOutput } from '../prompts.js';
import { printInfo, printSuccess, printError, openEditor, writeFile, extractText, extractJson, extractUsage } from './helpers.js';
import { getModelForStep } from '../config.js';
import type { Config, State, StepRecord } from '../types.js';

export async function runAnswer(): Promise<void> {
  const config = loadConfig();
  const repoRoot = getRepoRoot();

  // Find the current ticket from branch name
  const ticketId = await getCurrentTicketId(config, repoRoot);
  if (!ticketId) {
    printError("Not on a ticket branch. Run 'lv start <ticket-id>' first.");
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
  const stepModel = getModelForStep(config, currentStep);
  const threadId = `${ticketId}-${currentStep}`;

  if (currentStep === 'analysis') {
    const docFile = path.join(changesDir, '1.proposal.md');

    printInfo(`Opening ${path.basename(docFile)} for editing...`);
    openEditor(docFile);

    printInfo('Updating document based on your changes...');
    const prompt = buildAnalysisUpdatePrompt(ticketId, docFile, '1.proposal.md');

    const startTime = Date.now();
    const result = await analysisAgent.generate(prompt, {
      memory: { thread: threadId, resource: ticketId },
      model: stepModel,
    });
    const durationSeconds = (Date.now() - startTime) / 1000;

    writeFile(docFile, extractText(result));
    const usage = extractUsage(result);

    const updatedStepRecord = advanceStepRecord(state.steps.analysis, stepModel, usage, durationSeconds);
    const updatedState: State = { ...state, steps: { ...state.steps, analysis: updatedStepRecord } };

    writeState(repoRoot, updatedState);
    await commitAll(repoRoot, `lv: answer ${ticketId} ${currentStep} iteration ${updatedStepRecord.iterations}`);

    printSuccess(`Document updated. Iteration ${updatedStepRecord.iterations}.`);
    console.log(`\nReview ${path.basename(docFile)} and run 'lv answer' again or 'lv approve'.`);
    return;
  }

  // design step: design.md is what the engineer hand-edits; tasks.md and the spec deltas
  // are re-derived from it each iteration, same as the initial generation.
  const designFile = path.join(changesDir, '3.design.md');
  const tasksFile = path.join(changesDir, '5.tasks.md');
  const specsDir = path.join(changesDir, '2.specs');

  printInfo(`Opening ${path.basename(designFile)} for editing...`);
  openEditor(designFile);

  printInfo('Updating design, tasks, and spec deltas based on your changes...');
  const prompt = buildDesignUpdatePrompt(ticketId, designFile, tasksFile);

  const startTime = Date.now();
  const result = await designAgent.generate(prompt, {
    memory: { thread: threadId, resource: ticketId },
    model: stepModel,
  });
  const durationSeconds = (Date.now() - startTime) / 1000;

  const parsed = extractJson<DesignOutput>(extractText(result));
  const usage = extractUsage(result);

  writeFile(designFile, parsed.designMarkdown);
  writeFile(tasksFile, parsed.tasksMarkdown);
  writeSpecDeltas(specsDir, parsed.specDeltas);

  const updatedStepRecord = advanceStepRecord(state.steps.design, stepModel, usage, durationSeconds);
  const updatedState: State = { ...state, steps: { ...state.steps, design: updatedStepRecord } };

  writeState(repoRoot, updatedState);
  await commitAll(repoRoot, `lv: answer ${ticketId} ${currentStep} iteration ${updatedStepRecord.iterations}`);

  printSuccess(`Documents updated. Iteration ${updatedStepRecord.iterations}.`);
  console.log(`\nReview ${path.basename(designFile)} and run 'lv answer' again or 'lv approve'.`);
}

function advanceStepRecord(
  stepRecord: StepRecord | undefined,
  model: string,
  usage: { tokensIn: number; tokensOut: number },
  durationSeconds: number,
): StepRecord {
  const base = stepRecord ?? {
    status: 'in_progress' as const,
    iterations: 0,
    model,
    tokens_in: 0,
    tokens_out: 0,
    duration_seconds: 0,
  };
  return {
    ...base,
    status: 'in_progress' as const,
    iterations: base.iterations + 1,
    model,
    tokens_in: base.tokens_in + usage.tokensIn,
    tokens_out: base.tokens_out + usage.tokensOut,
    duration_seconds: base.duration_seconds + durationSeconds,
  };
}

// Reconciles docs/changes/<ticket-id>/2.specs/ with the latest specDeltas map, deleting
// delta files for features the agent no longer flags as changed.
function writeSpecDeltas(specsDir: string, deltas: Record<string, string>): void {
  const keep = new Set(Object.keys(deltas).map((featureId) => `${featureId}.md`));
  if (fs.existsSync(specsDir)) {
    for (const file of fs.readdirSync(specsDir)) {
      if (!keep.has(file)) fs.unlinkSync(path.join(specsDir, file));
    }
  }
  for (const [featureId, markdown] of Object.entries(deltas)) {
    writeFile(path.join(specsDir, `${featureId}.md`), markdown);
  }
}

async function getCurrentTicketId(config: Config, repoRoot: string): Promise<string | null> {
  const { currentBranch } = await import('../integrations/git/client.js');
  const branch = await currentBranch(repoRoot);
  return matchBranch(config, branch)?.ticketId ?? null;
}
