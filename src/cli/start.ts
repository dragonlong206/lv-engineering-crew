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
  updateTicketStatus,
  syncFeatureToLarkTable,
} from "../tools/lark.js";
import {
  createBranch,
  checkoutBranch,
  discardLocalBranch,
  commitAll,
  push,
} from "../integrations/git/client.js";
import { writeState, readState, stateExists } from "../engine/state-io.js";
import {
  renderBranchName,
  slugify,
  findChangeBranches,
  resolveBaseBranch,
} from "../engine/branch-naming.js";
import {
  allocateFeatureIds,
  listExistingFeatures,
  type ExistingFeature,
} from "../engine/feature-id.js";
import { generateFeatureDocsPlaceholder } from "./bootstrap.js";
import {
  printInfo,
  printSuccess,
  printError,
  printWarn,
  confirm,
  confirmSelection,
  confirmFeatureSplit,
  promptSelect,
  promptResumeOrRestart,
  extractText,
  extractJson,
} from "./helpers.js";
import { printStateSummary } from "./status.js";
import {
  buildFeatureMatchPrompt,
  buildFeatureSplitPrompt,
} from "../prompts.js";
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
 * Suggests existing features the given change might belong to, so `lv start` can offer them
 * instead of defaulting straight to "this is new." Returns an empty array when there are no
 * existing features with docs to compare against (no LLM call is made in that case), when the
 * model found no confident matches, or when it returned only IDs outside the candidate list.
 */
async function matchExistingFeature(
  config: Config,
  repoRoot: string,
  title: string,
  description: string,
): Promise<ExistingFeature[]> {
  const candidates = listExistingFeatures(repoRoot);

  if (candidates.length === 0) return [];

  const model = getModelForStep(config, "bootstrap");
  const result = await featureMatchAgent.generate(
    buildFeatureMatchPrompt(title, description, candidates),
    {
      model,
    },
  );
  const { featureIds } = extractJson<{ featureIds: string[] }>(
    extractText(result),
  );

  return candidates.filter((c) => featureIds.includes(c.id));
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

/**
 * Shows every matched existing feature and lets the engineer keep all (Enter), a comma-
 * separated subset of IDs, or none (typing "none", or a reply that matches no shown ID).
 * Returns the confirmed subset — may be empty, meaning no match should be used.
 */
async function confirmFeatureMatches(
  matches: ExistingFeature[],
): Promise<ExistingFeature[]> {
  return confirmSelection(matches, {
    header:
      matches.length > 1
        ? `Looks like this matches ${matches.length} existing features:`
        : `Looks like this matches an existing feature:`,
    formatLabel: (m) => `${m.id} — ${summarize(m)}`,
    promptText: `Press Enter to use all of them, type a comma-separated list of IDs to use a subset, or 'none' to skip: `,
    parseReplacement: (raw, items) => {
      if (raw.trim().toLowerCase() === "none") return [];
      const keepIds = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return items.filter((item) => keepIds.includes(item.id));
    },
  });
}

export interface StartOptions {
  type?: string;
  description?: string;
}

/**
 * Checks whether a branch for `changeId` already exists and, if so, walks the engineer through
 * resuming or restarting instead of letting the later `createBranch()` call fail on
 * `git checkout -b`. Runs before any Lark/LLM calls so a clean resume costs nothing extra.
 *
 * Returns `{ action: "resumed" }` when the change already has `state.yaml` — the caller should
 * stop immediately, same as `lv resume` would. Otherwise returns `{ action: "continue" }`, with
 * `existingBranchName` set when the caller should check out that branch instead of creating a
 * new one (resume with no `state.yaml` yet) — left undefined when there was no existing branch,
 * or the engineer chose to restart and it was discarded.
 *
 * `baseBranch` is the base branch resolved for the type actually being started (see
 * `resolveBaseBranch()`) — used to recreate the branch from on restart, so a restarted branch
 * forks from the same base branch a fresh start of that type would use.
 */
async function resolveExistingBranch(
  repoRoot: string,
  config: Config,
  changeId: string,
  baseBranch: string,
): Promise<
  { action: "resumed" } | { action: "continue"; existingBranchName?: string }
> {
  const candidates = await findChangeBranches(repoRoot, config, changeId);
  if (candidates.length === 0) return { action: "continue" };

  const branchName =
    candidates.length === 1
      ? candidates[0]
      : await promptSelect(
          `Multiple branches found for change '${changeId}'. Which one?`,
          candidates,
        );

  const choice = await promptResumeOrRestart(branchName);
  if (choice === "restart") {
    await discardLocalBranch(repoRoot, branchName, baseBranch);
    return { action: "continue" };
  }

  printInfo(`Checking out ${branchName}...`);
  await checkoutBranch(repoRoot, branchName);

  if (stateExists(repoRoot, changeId)) {
    const state = readState(repoRoot, changeId);
    printSuccess(`Resumed ${changeId}`);
    printStateSummary(changeId, state);
    console.log(
      `\nContinue with your coding agent's OpenSpec workflow (e.g. /opsx:propose or /opsx:apply).`,
    );
    return { action: "resumed" };
  }

  return { action: "continue", existingBranchName: branchName };
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

  const branchType = opts.type ?? config.default_branch_type;
  const baseBranch = resolveBaseBranch(config, branchType);

  const existing = await resolveExistingBranch(
    repoRoot,
    config,
    ticketId,
    baseBranch,
  );
  if (existing.action === "resumed") return;
  const existingBranchName = existing.existingBranchName;

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
    config.lark.ui_design_field,
  );

  // Branch name embeds the ticket title as a summary slug, so it's rendered once we have the
  // ticket in hand rather than up front — unless we're resuming on an already-checked-out
  // branch (no state.yaml yet), in which case we keep that branch's actual name rather than
  // rendering a possibly-different one.
  const branchName =
    existingBranchName ??
    renderBranchName(config, ticketId, {
      type: opts.type,
      summary: ticket.title,
    });

  // A ticket with no Feature ID yet is treated as introducing one or more new features —
  // allocate IDs for them now rather than requiring the ticket to be set in Lark first. But
  // first, check whether it's actually more work on a feature that already exists.
  let featureIds = ticket.featureIds;
  const ticketHadNoFeatureId = featureIds.length === 0;
  const newFeatureTitles = new Map<string, string>();

  if (featureIds.length === 0) {
    printInfo(
      `Ticket ${ticketId} has no feature ID. Checking for existing features that match this change...`,
    );
    const candidates = await matchExistingFeature(
      config,
      repoRoot,
      ticket.title,
      ticket.description,
    );
    const matched =
      candidates.length > 0 ? await confirmFeatureMatches(candidates) : [];

    if (matched.length > 0) {
      printInfo(
        `Using existing feature${matched.length > 1 ? "s" : ""} ${matched.map((m) => m.id).join(", ")}.`,
      );
      featureIds = matched.map((m) => m.id);
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
      allocated.forEach((id, i) =>
        newFeatureTitles.set(id, confirmedTitles[i]),
      );
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
      printInfo(`Writing placeholder docs for new feature '${featureId}'...`);
      generated.push(generateFeatureDocsPlaceholder(repoRoot, featureId));
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
  // sync attempt failed). Its return value (the Features-table record_id) is captured here
  // because a Link-typed `feature_id_field` needs it below to write the ticket back.
  const featureRecordIds = new Map<string, string>();
  for (const featureId of featureIds) {
    const recordId = await syncFeatureToLarkTable(
      config,
      larkToken,
      featureId,
      newFeatureTitles.get(featureId) ?? ticket.title,
      ticket.projectRecordIds,
    );
    if (recordId) featureRecordIds.set(featureId, recordId);
  }

  if (ticketHadNoFeatureId && featureIds.length > 0) {
    if (config.lark.sync_feature_id) {
      try {
        await updateTicketFeatureId(
          ticket,
          featureIds,
          config.lark.base_id,
          config.lark.table_id,
          config.lark.feature_id_field,
          larkToken,
          featureRecordIds,
        );
        printSuccess(
          `Synced feature${featureIds.length > 1 ? "s" : ""} ${featureIds.join(", ")} back to Lark ticket ${ticketId}.`,
        );
      } catch (err) {
        printWarn(
          `Failed to sync feature${featureIds.length > 1 ? "s" : ""} ${featureIds.join(", ")} back to Lark: ${(err as Error).message}. ` +
            `Continuing — the feature${featureIds.length > 1 ? "s remain" : " remains"} local-only.`,
        );
      }
    } else {
      printInfo(
        `Lark sync disabled (lark.sync_feature_id: false) — ${featureIds.join(", ")} ${featureIds.length > 1 ? "are" : "is"} local-only.`,
      );
    }
  }

  if (config.lark.sync_status) {
    const currentStatus = ticket.rawFields[config.lark.status_field];
    if (currentStatus !== config.lark.in_dev_status_value) {
      try {
        await updateTicketStatus(
          ticket,
          config.lark.in_dev_status_value,
          config.lark.base_id,
          config.lark.table_id,
          config.lark.status_field,
          larkToken,
        );
        printSuccess(
          `Updated ticket ${ticketId} status to "${config.lark.in_dev_status_value}".`,
        );
      } catch (err) {
        printWarn(
          `Failed to update ticket ${ticketId} status to "${config.lark.in_dev_status_value}": ${(err as Error).message}. Continuing.`,
        );
      }
    }
  } else {
    printInfo(
      `Lark status sync disabled (lark.sync_status: false) — ticket ${ticketId}'s status is unchanged.`,
    );
  }

  if (existingBranchName) {
    printInfo(`Continuing on existing branch ${existingBranchName}...`);
  } else {
    printInfo(`Creating branch ${branchName}...`);
    await createBranch(repoRoot, branchName, baseBranch);
  }

  const now = new Date().toISOString();
  const state: State = {
    ticket_id: ticketId,
    title: ticket.title,
    description: ticket.description,
    feature_ids: featureIds,
    branch: branchName,
    created_at: now,
    lv_version: LV_VERSION,
    openspec_changes: [],
    ...(ticket.uiDesignRefs.length > 0
      ? { ui_design: ticket.uiDesignRefs }
      : {}),
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

  const branchType = opts.type ?? config.default_branch_type;
  const baseBranch = resolveBaseBranch(config, branchType);

  const existing = await resolveExistingBranch(
    repoRoot,
    config,
    changeId,
    baseBranch,
  );
  if (existing.action === "resumed") return;
  const existingBranchName = existing.existingBranchName;

  let featureIds: string[] = [];
  const candidates = await matchExistingFeature(
    config,
    repoRoot,
    title,
    description,
  );
  if (candidates.length > 0) {
    const matched = await confirmFeatureMatches(candidates);
    if (matched.length > 0) {
      printInfo(
        `Using existing feature${matched.length > 1 ? "s" : ""} ${matched.map((m) => m.id).join(", ")}.`,
      );
      featureIds = matched.map((m) => m.id);
    }
  }

  // changeId is already a slug of the title, so it doubles as {summary} too — passing
  // `title` again as `summary` would duplicate it in the rendered branch name. Unless we're
  // resuming on an already-checked-out branch, in which case keep its actual name.
  const branchName =
    existingBranchName ??
    renderBranchName(config, changeId, { type: opts.type });

  if (existingBranchName) {
    printInfo(`Continuing on existing branch ${existingBranchName}...`);
  } else {
    printInfo(`Creating branch ${branchName}...`);
    await createBranch(repoRoot, branchName, baseBranch);
  }

  const now = new Date().toISOString();
  const state: State = {
    title,
    description,
    feature_ids: featureIds,
    branch: branchName,
    created_at: now,
    lv_version: LV_VERSION,
    openspec_changes: [],
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
