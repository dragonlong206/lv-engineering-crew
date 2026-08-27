import fs from "fs";
import { Agent } from "@mastra/core/agent";
import {
  loadConfig,
  getRepoRoot,
  getFeatureDir,
  getModelForStep,
} from "../config.js";
import {
  fetchTicket,
  getTenantAccessToken,
  updateTicketFeatureId,
  syncFeatureToLarkTable,
} from "../tools/lark.js";
import { createBranch, commitAll, push } from "../integrations/git/client.js";
import { writeState } from "../engine/state-io.js";
import { renderBranchName, slugify } from "../engine/branch-naming.js";
import {
  allocateFeatureIds,
  listExistingFeatures,
  type ExistingFeature,
} from "../engine/feature-id.js";
import { generateFeatureDocsFromScan } from "./bootstrap.js";
import {
  printInfo,
  printSuccess,
  printError,
  printWarn,
  confirm,
  confirmFeatureSplit,
  extractText,
  extractJson,
} from "./helpers.js";
import { buildFeatureMatchPrompt, buildFeatureSplitPrompt } from "../prompts.js";
import { LV_VERSION, type Config, type State } from "../types.js";

const featureMatchAgent = new Agent({
  id: "lv-feature-match-agent",
  name: "LV Feature Match Agent",
  model: "openai/gpt-4o-mini",
  instructions:
    "You are an assistant that matches project changes to existing features. Follow the user's prompt exactly and return only strict JSON — no surrounding text.",
});

const featureSplitAgent = new Agent({
  id: "lv-feature-split-agent",
  name: "LV Feature Split Agent",
  model: "openai/gpt-4o-mini",
  instructions:
    "You are an assistant that splits a project change into the distinct new features it introduces. Follow the user's prompt exactly and return only strict JSON — no surrounding text.",
});

/**
 * Suggests an existing feature the given change might belong to, so `lv start` can offer it
 * instead of defaulting straight to "this is new." Returns `undefined` when there are no
 * existing features with docs to compare against (no LLM call is made in that case), when the
 * model found no confident match, or when it returned an ID outside the candidate list.
 */
async function matchExistingFeature(
  config: Config,
  repoRoot: string,
  title: string,
  description: string,
): Promise<ExistingFeature | undefined> {
  const candidates = listExistingFeatures(repoRoot);

  if (candidates.length === 0) return undefined;

  const model = getModelForStep(config, "bootstrap");
  const result = await featureMatchAgent.generate(
    buildFeatureMatchPrompt(title, description, candidates),
    {
      model,
    },
  );
  const { featureId } = extractJson<{ featureId: string | null }>(
    extractText(result),
  );
  if (!featureId) return undefined;

  return candidates.find((c) => c.id === featureId);
}

/**
 * Infers how many distinct new features a change with no confirmed existing-feature match
 * implies, so `lv start` can offer the engineer a set to confirm instead of always allocating
 * exactly one. Always returns at least one entry — falls back to a single feature titled after
 * the change if the model returns an empty list.
 */
async function inferFeatureSplit(
  config: Config,
  title: string,
  description: string,
): Promise<{ title: string }[]> {
  const model = getModelForStep(config, "bootstrap");
  const result = await featureSplitAgent.generate(
    buildFeatureSplitPrompt(title, description),
    { model },
  );
  const { features } = extractJson<{ features: { title: string }[] }>(
    extractText(result),
  );
  return features.length > 0 ? features : [{ title }];
}

/** First non-empty line of a feature's overview.md, for a short human-readable summary. */
function summarize(feature: ExistingFeature): string {
  const line = feature.overview
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return line ?? feature.id;
}

export interface StartOptions {
  type?: string;
  description?: string;
}

export async function runStart(
  ticketId: string | undefined,
  opts: StartOptions = {},
): Promise<void> {
  if (ticketId) {
    await startFromTicket(ticketId, opts);
    return;
  }

  if (opts.description) {
    await startFromDescription(opts.description, opts);
    return;
  }

  printError(
    'Provide a ticket ID (lv start <ticket-id>) or a description (lv start --description "...").',
  );
  process.exit(1);
}

async function startFromTicket(
  ticketId: string,
  opts: StartOptions,
): Promise<void> {
  const config = loadConfig();
  const repoRoot = getRepoRoot();

  if (!config.lark_app_id || !config.lark_app_secret) {
    printError(
      "Missing Lark app credentials. Set 'lark_app_id' and 'lark_app_secret' in .lv.local.yaml (or LARK_APP_ID/LARK_APP_SECRET env vars).",
    );
    process.exit(1);
  }

  const larkToken = await getTenantAccessToken(
    config.lark_app_id,
    config.lark_app_secret,
  );

  printInfo(`Fetching ticket ${ticketId} from Lark Base...`);
  const ticket = await fetchTicket(
    ticketId,
    config.lark.base_id,
    config.lark.table_id,
    config.lark.feature_id_field,
    config.lark.title_field,
    config.lark.project_field,
    larkToken,
  );

  // Branch name embeds the ticket title as a summary slug, so it's rendered
  // once we have the ticket in hand rather than up front.
  const branchName = renderBranchName(config, ticketId, {
    type: opts.type,
    summary: ticket.title,
  });

  // A ticket with no Feature ID yet is treated as introducing one or more new features —
  // allocate IDs for them now rather than requiring the ticket to be set in Lark first. But
  // first, check whether it's actually more work on a feature that already exists.
  let featureIds = ticket.featureIds;
  let newlyAllocatedFeatureIds: string[] = [];
  const newFeatureTitles = new Map<string, string>();

  if (featureIds.length === 0) {
    printInfo(
      `Ticket ${ticketId} has no feature ID. Checking for existing features that match this change...`,
    );
    const match = await matchExistingFeature(
      config,
      repoRoot,
      ticket.title,
      ticket.description,
    );
    let matched: ExistingFeature | undefined;
    if (match) {
      const proceed = await confirm(
        `Looks like this matches ${match.id} (${summarize(match)}). Use it? [y/N] `,
      );
      if (proceed) matched = match;
    }

    if (matched) {
      printInfo(`Using existing feature ${matched.id}.`);
      featureIds = [matched.id];
    } else {
      const inferred = await inferFeatureSplit(
        config,
        ticket.title,
        ticket.description,
      );
      const confirmedTitles = await confirmFeatureSplit(inferred);
      const allocated = allocateFeatureIds(
        repoRoot,
        confirmedTitles.length,
        config.feature_id_prefix,
        config.feature_id_digits,
      );
      printInfo(
        `No match, allocated new feature${allocated.length > 1 ? "s" : ""} ${allocated.join(", ")}.`,
      );
      featureIds = allocated;
      newlyAllocatedFeatureIds = allocated;
      allocated.forEach((id, i) => newFeatureTitles.set(id, confirmedTitles[i]));
    }
  }

  const featureDirs: { id: string; path: string }[] = featureIds.map((id) => ({
    id,
    path: getFeatureDir(repoRoot, id),
  }));
  const missingFeatureIds = featureDirs
    .filter((f) => !fs.existsSync(f.path))
    .map((f) => f.id);

  if (missingFeatureIds.length > 0) {
    const generated = [];
    for (const featureId of missingFeatureIds) {
      printInfo(
        `Scanning codebase to generate docs for new feature '${featureId}'...`,
      );
      generated.push(
        await generateFeatureDocsFromScan(config, repoRoot, featureId, {
          name: newFeatureTitles.get(featureId) ?? ticket.title,
          description: ticket.description,
        }),
      );
    }

    console.log(`\nGenerated feature docs (not yet committed):`);
    for (const docs of generated) {
      console.log(`  ${docs.overviewPath}`);
      console.log(`  ${docs.designPath}`);
    }

    const proceed = await confirm(
      `\nReview the files above. Continue starting ${ticketId}? [y/N] `,
    );
    if (!proceed) {
      printInfo(
        `Stopped. Edit the files above as needed, then re-run 'lv start ${ticketId}' to continue.`,
      );
      return;
    }
  }

  // Sync every referenced feature, not just ones whose docs were just generated —
  // `syncFeatureToLarkTable()` checks Lark itself for an existing record, so this also
  // backfills a feature whose docs directory already existed locally but never got a Lark
  // Features-table record (e.g. created before `features_table_id` was configured, or a prior
  // sync attempt failed).
  for (const featureId of featureIds) {
    await syncFeatureToLarkTable(
      config,
      larkToken,
      featureId,
      newFeatureTitles.get(featureId) ?? ticket.title,
      ticket.projectRecordIds,
    );
  }

  if (newlyAllocatedFeatureIds.length > 0) {
    if (config.lark.sync_feature_id) {
      try {
        await updateTicketFeatureId(
          ticket,
          newlyAllocatedFeatureIds,
          config.lark.base_id,
          config.lark.table_id,
          config.lark.feature_id_field,
          larkToken,
        );
        printSuccess(
          `Synced feature${newlyAllocatedFeatureIds.length > 1 ? "s" : ""} ${newlyAllocatedFeatureIds.join(", ")} back to Lark ticket ${ticketId}.`,
        );
      } catch (err) {
        printWarn(
          `Failed to sync feature${newlyAllocatedFeatureIds.length > 1 ? "s" : ""} ${newlyAllocatedFeatureIds.join(", ")} back to Lark: ${(err as Error).message}. ` +
            `Continuing — the allocation${newlyAllocatedFeatureIds.length > 1 ? "s are" : " is"} local-only.`,
        );
      }
    } else {
      printInfo(
        `Lark sync disabled (lark.sync_feature_id: false) — ${newlyAllocatedFeatureIds.join(", ")} ${newlyAllocatedFeatureIds.length > 1 ? "are" : "is"} local-only.`,
      );
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

  printSuccess(`Started ticket ${ticketId}`);
  printNextSteps(ticketId);
}

async function startFromDescription(
  description: string,
  opts: StartOptions,
): Promise<void> {
  const config = loadConfig();
  const repoRoot = getRepoRoot();

  const title = deriveTitle(description);
  const changeId = changeIdSlug(title) || `change_${Date.now()}`;

  let featureIds: string[] = [];
  const match = await matchExistingFeature(
    config,
    repoRoot,
    title,
    description,
  );
  if (match) {
    const proceed = await confirm(
      `Looks like this matches ${match.id} (${summarize(match)}). Use it? [y/N] `,
    );
    if (proceed) {
      printInfo(`Using existing feature ${match.id}.`);
      featureIds = [match.id];
    }
  }

  // changeId is already a slug of the title, so it doubles as {summary} too — passing
  // `title` again as `summary` would duplicate it in the rendered branch name.
  const branchName = renderBranchName(config, changeId, { type: opts.type });

  printInfo(`Creating branch ${branchName}...`);
  await createBranch(repoRoot, branchName, config.default_branch);

  const now = new Date().toISOString();
  const state: State = {
    title,
    description,
    feature_ids: featureIds,
    branch: branchName,
    created_at: now,
    lv_version: LV_VERSION,
  };
  writeState(repoRoot, changeId, state);

  await commitAll(repoRoot, `lv: start ${changeId} — change context`);

  printSuccess(`Started change ${changeId}`);
  printNextSteps(changeId);
}

function printNextSteps(changeId: string): void {
  console.log(`\nContext: docs/changes/${changeId}/state.yaml`);
  console.log(
    `\nContinue with your coding agent's OpenSpec workflow (e.g. /opsx:propose) to explore, propose, and design this change.`,
  );
}

/** A short title for state.yaml/branch summary — the description's first line, truncated. */
function deriveTitle(description: string, maxLength = 80): string {
  const firstLine = description.split("\n")[0].trim() || description.trim();
  if (firstLine.length <= maxLength) return firstLine;
  return `${firstLine.slice(0, maxLength).replace(/\s+\S*$/, "")}...`;
}

/**
 * A change ID standing in for `{ticket_id}` in the branch pattern must not contain the
 * pattern's own separator (`-` by default) — matchBranch()'s non-greedy {ticket_id} capture
 * assumes that, same as it does for real (hyphen-free) Lark ticket IDs. `slugify()` produces
 * hyphens, so swap them for underscores here rather than reusing it directly.
 */
function changeIdSlug(text: string): string {
  return slugify(text).replace(/-/g, "_");
}
