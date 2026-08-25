import fs from 'fs';
import path from 'path';
import { loadConfig, getRepoRoot, getChangesDir, getFeatureDir } from '../config.js';
import { fetchTicket, getTenantAccessToken, updateTicketFeatureId } from '../tools/lark.js';
import { createBranch, commitAll, push } from '../integrations/git/client.js';
import { writeState } from '../engine/state-io.js';
import { renderBranchName } from '../engine/branch-naming.js';
import { allocateFeatureIds } from '../engine/feature-id.js';
import { generateFeatureDocsFromScan } from './bootstrap.js';
import { analysisAgent } from '../agents/analysis-agent.js';
import { buildAnalysisPrompt } from '../prompts.js';
import { printInfo, printSuccess, printError, printWarn, confirm, writeFile, extractText, extractUsage } from './helpers.js';
import { LV_VERSION } from '../types.js';
import { getModelForStep } from '../config.js';

export async function runStart(ticketId: string, opts: { type?: string } = {}): Promise<void> {
  const config = loadConfig();
  const repoRoot = getRepoRoot();

  if (!config.lark_app_id || !config.lark_app_secret) {
    printError("Missing Lark app credentials. Set 'lark_app_id' and 'lark_app_secret' in .lv.local.yaml (or LARK_APP_ID/LARK_APP_SECRET env vars).");
    process.exit(1);
  }

  const larkToken = await getTenantAccessToken(config.lark_app_id, config.lark_app_secret);

  printInfo(`Fetching ticket ${ticketId} from Lark Base...`);
  const ticket = await fetchTicket(
    ticketId,
    config.lark.base_id,
    config.lark.table_id,
    config.lark.feature_id_field,
    config.lark.title_field,
    larkToken,
  );

  // Branch name embeds the ticket title as a summary slug, so it's rendered
  // once we have the ticket in hand rather than up front.
  const branchName = renderBranchName(config, ticketId, { type: opts.type, summary: ticket.title });

  // A ticket with no Feature ID yet is treated as introducing exactly one new feature —
  // allocate an ID for it now rather than requiring it to be set in Lark first.
  let featureIds = ticket.featureIds;
  let newlyAllocatedFeatureId: string | undefined;

  if (featureIds.length === 0) {
    const [allocated] = allocateFeatureIds(repoRoot, 1, config.feature_id_prefix, config.feature_id_digits);
    printInfo(`Ticket has no '${config.lark.feature_id_field}' set — allocated new feature ${allocated}.`);
    featureIds = [allocated];
    newlyAllocatedFeatureId = allocated;
  }

  const featureDirs: { id: string; path: string }[] = featureIds.map((id) => ({
    id,
    path: getFeatureDir(repoRoot, id),
  }));
  const missingFeatureIds = featureDirs.filter((f) => !fs.existsSync(f.path)).map((f) => f.id);

  if (missingFeatureIds.length > 0) {
    const generated = [];
    for (const featureId of missingFeatureIds) {
      printInfo(`Scanning codebase to generate docs for new feature '${featureId}'...`);
      generated.push(
        await generateFeatureDocsFromScan(config, repoRoot, featureId, {
          name: ticket.title,
          description: ticket.description,
        }),
      );
    }

    console.log(`\nGenerated feature docs (not yet committed):`);
    for (const docs of generated) {
      console.log(`  ${docs.overviewPath}`);
      console.log(`  ${docs.designPath}`);
      console.log(`  ${docs.requirementsPath}`);
    }

    const proceed = await confirm(`\nReview the files above. Continue starting ${ticketId}? [y/N] `);
    if (!proceed) {
      printInfo(`Stopped. Edit the files above as needed, then re-run 'lv start ${ticketId}' to continue.`);
      return;
    }
  }

  if (newlyAllocatedFeatureId) {
    if (config.lark.sync_feature_id) {
      try {
        await updateTicketFeatureId(
          ticket,
          newlyAllocatedFeatureId,
          config.lark.base_id,
          config.lark.table_id,
          config.lark.feature_id_field,
          larkToken,
        );
        printSuccess(`Synced feature ${newlyAllocatedFeatureId} back to Lark ticket ${ticketId}.`);
      } catch (err) {
        printWarn(
          `Failed to sync feature ${newlyAllocatedFeatureId} back to Lark: ${(err as Error).message}. ` +
            `Continuing — the allocation is local-only.`,
        );
      }
    } else {
      printInfo(`Lark sync disabled (lark.sync_feature_id: false) — ${newlyAllocatedFeatureId} is local-only.`);
    }
  }

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
  const analysisFile = path.join(changesDir, '1.proposal.md');
  writeFile(analysisFile, analysisContent);

  const now = new Date().toISOString();
  writeState(repoRoot, {
    ticket_id: ticketId,
    feature_ids: featureIds,
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
