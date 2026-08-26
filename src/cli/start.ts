import fs from 'fs';
import { loadConfig, getRepoRoot, getFeatureDir } from '../config.js';
import { fetchTicket, getTenantAccessToken, updateTicketFeatureId } from '../tools/lark.js';
import { createBranch, commitAll, push } from '../integrations/git/client.js';
import { writeState } from '../engine/state-io.js';
import { renderBranchName, slugify } from '../engine/branch-naming.js';
import { allocateFeatureIds } from '../engine/feature-id.js';
import { generateFeatureDocsFromScan } from './bootstrap.js';
import { printInfo, printSuccess, printError, printWarn, confirm } from './helpers.js';
import { LV_VERSION, type State } from '../types.js';

export interface StartOptions {
  type?: string;
  description?: string;
}

export async function runStart(ticketId: string | undefined, opts: StartOptions = {}): Promise<void> {
  if (ticketId) {
    await startFromTicket(ticketId, opts);
    return;
  }

  if (opts.description) {
    await startFromDescription(opts.description, opts);
    return;
  }

  printError("Provide a ticket ID (lv start <ticket-id>) or a description (lv start --description \"...\").");
  process.exit(1);
}

async function startFromTicket(ticketId: string, opts: StartOptions): Promise<void> {
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

  const now = new Date().toISOString();
  const state: State = {
    ticket_id: ticketId,
    title: ticket.title,
    description: ticket.description,
    feature_ids: featureIds,
    branch: branchName,
    created_at: now,
    lv_version: LV_VERSION,
  };
  writeState(repoRoot, ticketId, state);

  await commitAll(repoRoot, `lv: start ${ticketId} — change context`);

  await pushBranch(repoRoot, branchName);

  printSuccess(`Started ticket ${ticketId}`);
  printNextSteps(ticketId);
}

async function startFromDescription(description: string, opts: StartOptions): Promise<void> {
  const config = loadConfig();
  const repoRoot = getRepoRoot();

  const title = deriveTitle(description);
  const changeId = changeIdSlug(title) || `change_${Date.now()}`;

  // changeId is already a slug of the title, so it doubles as {summary} too — passing
  // `title` again as `summary` would duplicate it in the rendered branch name.
  const branchName = renderBranchName(config, changeId, { type: opts.type });

  printInfo(`Creating branch ${branchName}...`);
  await createBranch(repoRoot, branchName, config.default_branch);

  const now = new Date().toISOString();
  const state: State = {
    title,
    description,
    feature_ids: [],
    branch: branchName,
    created_at: now,
    lv_version: LV_VERSION,
  };
  writeState(repoRoot, changeId, state);

  await commitAll(repoRoot, `lv: start ${changeId} — change context`);

  await pushBranch(repoRoot, branchName);

  printSuccess(`Started change ${changeId}`);
  printNextSteps(changeId);
}

async function pushBranch(repoRoot: string, branchName: string): Promise<void> {
  try {
    printInfo(`Pushing branch ${branchName}...`);
    await push(repoRoot, branchName);
    printSuccess(`Branch pushed.`);
  } catch {
    printError('Push failed — no remote configured or no network. Commit is local.');
  }
}

function printNextSteps(changeId: string): void {
  console.log(`\nContext: docs/changes/${changeId}/state.yaml`);
  console.log(`\nContinue with your coding agent's OpenSpec workflow (e.g. /opsx:propose) to explore, propose, and design this change.`);
}

/** A short title for state.yaml/branch summary — the description's first line, truncated. */
function deriveTitle(description: string, maxLength = 80): string {
  const firstLine = description.split('\n')[0].trim() || description.trim();
  if (firstLine.length <= maxLength) return firstLine;
  return `${firstLine.slice(0, maxLength).replace(/\s+\S*$/, '')}...`;
}

/**
 * A change ID standing in for `{ticket_id}` in the branch pattern must not contain the
 * pattern's own separator (`-` by default) — matchBranch()'s non-greedy {ticket_id} capture
 * assumes that, same as it does for real (hyphen-free) Lark ticket IDs. `slugify()` produces
 * hyphens, so swap them for underscores here rather than reusing it directly.
 */
function changeIdSlug(text: string): string {
  return slugify(text).replace(/-/g, '_');
}
