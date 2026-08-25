import path from 'path';
import fs from 'fs';
import { loadConfig, getRepoRoot, getChangesDir, getFeatureDir } from '../config.js';
import { readState, writeState } from '../engine/state-io.js';
import { StateMachine } from '../engine/state-machine.js';
import { matchBranch } from '../engine/branch-naming.js';
import { commitAll, currentBranch } from '../integrations/git/client.js';
import { designAgent } from '../agents/design-agent.js';
import { buildDesignPrompt, type DesignOutput } from '../prompts.js';
import { printInfo, printSuccess, printError, writeFile, extractText, extractJson, extractUsage } from './helpers.js';
import { getModelForStep } from '../config.js';
import type { State } from '../types.js';

export async function runDesign(): Promise<void> {
  const config = loadConfig();
  const repoRoot = getRepoRoot();

  const branch = await currentBranch(repoRoot);
  const matched = matchBranch(config, branch);
  if (!matched) {
    printError("Not on a ticket branch. Run 'lv start <ticket-id>' first.");
    process.exit(1);
  }
  const ticketId = matched.ticketId;

  const state = readState(repoRoot, ticketId);
  const machine = new StateMachine(state);

  const check = machine.canRun('design');
  if (!check.ok) {
    printError(check.reason ?? 'Cannot run design now.');
    process.exit(1);
  }

  const featureDirs: { id: string; path: string }[] = [];
  for (const featureId of state.feature_ids) {
    const featureDir = getFeatureDir(repoRoot, featureId);
    if (fs.existsSync(featureDir)) {
      featureDirs.push({ id: featureId, path: featureDir });
    }
  }

  const changesDir = getChangesDir(repoRoot, ticketId);
  const analysisFile = path.join(changesDir, '1.proposal.md');
  const designFile = path.join(changesDir, '3.design.md');
  const tasksFile = path.join(changesDir, '5.tasks.md');
  const specsDir = path.join(changesDir, '2.specs');

  printInfo('Generating design document...');
  const prompt = buildDesignPrompt(ticketId, analysisFile, featureDirs, repoRoot);
  const threadId = `${ticketId}-design`;
  const designModel = getModelForStep(config, 'design');

  const startTime = Date.now();
  const result = await designAgent.generate(prompt, {
    memory: { thread: threadId, resource: ticketId },
    model: designModel,
  });
  const durationSeconds = (Date.now() - startTime) / 1000;

  const parsed = extractJson<DesignOutput>(extractText(result));
  const usage = extractUsage(result);

  writeFile(designFile, parsed.designMarkdown);
  writeFile(tasksFile, parsed.tasksMarkdown);
  for (const [featureId, markdown] of Object.entries(parsed.specDeltas)) {
    writeFile(path.join(specsDir, `${featureId}.md`), markdown);
  }

  const advancedState = machine.advance();
  const updatedState: State = {
    ...advancedState,
    steps: {
      ...advancedState.steps,
      design: {
        status: 'in_progress' as const,
        iterations: 1,
        model: designModel,
        tokens_in: usage.tokensIn,
        tokens_out: usage.tokensOut,
        duration_seconds: durationSeconds,
      },
    },
  };

  writeState(repoRoot, updatedState);
  await commitAll(repoRoot, `lv: design ${ticketId} — draft`);

  printSuccess(`Implementation plan generated.`);
  console.log(`\nDesign: ${designFile}`);
  console.log(`Tasks: ${tasksFile}`);
  if (Object.keys(parsed.specDeltas).length > 0) {
    console.log(`Spec deltas: ${specsDir}`);
  }
  console.log(`\nReview the documents and answer the questions, then run 'lv answer'.`);
}
