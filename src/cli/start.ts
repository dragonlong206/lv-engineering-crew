import fs from 'fs';
import path from 'path';
import { loadConfig, getRepoRoot, getChangesDir, getFeatureDir } from '../config.js';
import { fetchTicket } from '../tools/lark.js';
import { createBranch, commitAll, push } from '../integrations/git/client.js';
import { writeState } from '../engine/state-io.js';
import { analysisAgent, buildAnalysisPrompt } from '../agents/analysis-agent.js';
import { printInfo, printSuccess, printError, writeFile, extractText, extractUsage } from './helpers.js';
import { LV_VERSION } from '../types.js';
import { getModelForStep } from '../config.js';

export async function runStart(ticketId: string): Promise<void> {
  const config = loadConfig();
  const repoRoot = getRepoRoot();

  printInfo(`Fetching ticket ${ticketId} from Lark Base...`);
  const ticket = await fetchTicket(
    ticketId,
    config.lark.base_id,
    config.lark.table_id,
    config.lark.feature_id_field,
    config.lark_token,
  );

  if (ticket.featureIds.length === 0) {
    printError(
      `Ticket ${ticketId} does not have a '${config.lark.feature_id_field}' field. ` +
        `Set it in Lark Base before running 'lv start'.`,
    );
    process.exit(1);
  }

  // Validate feature directories exist
  const missingFeatures: string[] = [];
  const featureDirs: { id: string; path: string }[] = [];

  for (const featureId of ticket.featureIds) {
    const featureDir = getFeatureDir(repoRoot, featureId);
    if (!fs.existsSync(featureDir)) {
      missingFeatures.push(featureId);
    } else {
      featureDirs.push({ id: featureId, path: featureDir });
    }
  }

  if (missingFeatures.length > 0) {
    printError(`Feature directories not found: ${missingFeatures.join(', ')}`);
    console.error(`Run 'lv bootstrap <feature-id> --paths <paths>' to create them.`);
    process.exit(1);
  }

  const branchName = `lv/${ticketId}`;
  printInfo(`Creating branch ${branchName}...`);
  await createBranch(repoRoot, branchName, config.default_branch);

  printInfo('Generating analysis document...');
  const prompt = buildAnalysisPrompt(ticket, featureDirs, repoRoot);
  const threadId = `${ticketId}-analysis`;

  const analysisModel = getModelForStep(config, 'analysis');
  const startTime = Date.now();
  const result = await analysisAgent.generate(prompt, {
    memory: { thread: threadId, resource: ticketId },
    model: analysisModel,
  });
  const durationSeconds = (Date.now() - startTime) / 1000;

  const analysisContent = extractText(result);
  const usage = extractUsage(result);

  const changesDir = getChangesDir(repoRoot, ticketId);
  const analysisFile = path.join(changesDir, '01-analysis.md');
  writeFile(analysisFile, analysisContent);

  const now = new Date().toISOString();
  writeState(repoRoot, {
    ticket_id: ticketId,
    feature_ids: ticket.featureIds,
    branch: branchName,
    current_step: 'analysis',
    steps: {
      analysis: {
        status: 'in_progress',
        iterations: 1,
        model: analysisModel,
        tokens_in: usage.tokensIn,
        tokens_out: usage.tokensOut,
        duration_seconds: durationSeconds,
      },
    },
    created_at: now,
    lv_version: LV_VERSION,
  });

  await commitAll(repoRoot, `lv: start ${ticketId} — analysis draft`);

  try {
    printInfo(`Pushing branch ${branchName}...`);
    await push(repoRoot, branchName);
    printSuccess(`Branch pushed.`);
  } catch {
    printError('Push failed — no remote configured or no network. Commit is local.');
  }

  printSuccess(`Started ticket ${ticketId}`);
  console.log(`\nAnalysis: ${analysisFile}`);
  console.log(`\nReview the document and answer the questions, then run 'lv answer'.`);
}
