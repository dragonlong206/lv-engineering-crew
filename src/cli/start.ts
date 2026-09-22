import fs from "fs";
import path from "path";
import {
  loadConfig,
  getRepoRoot,
  getFeatureDir,
  getChangesDir,
} from "../config.js";
import { syncFeatureToLarkTable } from "../tools/lark.js";
import { createBranch, commitAll } from "../integrations/git/client.js";
import { writeState } from "../engine/state-io.js";
import {
  renderBranchName,
  slugify,
  resolveBaseBranch,
} from "../engine/branch-naming.js";
import { allocateFeatureIds } from "../engine/feature-id.js";
import {
  matchExistingFeature,
  inferFeatureSplit,
  confirmFeatureMatches,
} from "../engine/feature-matching.js";
import { resolveExistingBranch } from "../engine/branch-resolution.js";
import { analyzeTaskComplexity } from "../engine/task-splitting.js";
import { generateFeatureDocsPlaceholder } from "./bootstrap.js";
import { createLarkTicketSource } from "../integrations/tickets/lark-ticket-source.js";
import {
  printInfo,
  printSuccess,
  printError,
  printWarn,
  confirm,
  confirmFeatureSplit,
  confirmTaskSplit,
} from "./helpers.js";
import { LV_VERSION, type State } from "../types.js";

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

  const source = createLarkTicketSource(config);
  const ticket = await source.fetch(ticketId);

  if (config.task_splitting?.enabled !== false) {
    const thresholdHours = config.task_splitting?.threshold_hours ?? 4;
    const suggestion = await analyzeTaskComplexity(
      config,
      ticket.title,
      ticket.description,
      thresholdHours,
    );

    if (suggestion.shouldSplit) {
      const confirmed = await confirmTaskSplit(suggestion.reason, suggestion.subtasks);
      if (confirmed) {
        const { created, failed } = await source.createSubtickets(
          ticket,
          suggestion.subtasks,
        );

        if (created.length > 0) {
          console.log(`\nCreated ${created.length} sub-task(s):`);
          for (const sub of created) {
            console.log(`  ${sub.id} — ${sub.title}`);
          }
        }
        for (const failure of failed) {
          printWarn(`Failed to create sub-task '${failure.title}': ${failure.error}.`);
        }

        console.log(
          `\nStart each sub-task with 'lv start <sub-ticket-id>' — one at a time, or in parallel across separate branches/coding-agent sessions.`,
        );
        printInfo(
          `Stopped without creating a branch for ${ticketId} — its work now lives in the sub-task(s) above.`,
        );
        return;
      }
    }
  }

  let downloadedAttachmentPaths: string[] = [];
  if (ticket.attachments.length > 0) {
    const attachmentsDir = path.join(getChangesDir(repoRoot, ticketId), "attachments");
    const { downloaded, failed } = await source.downloadAttachments(
      ticket,
      attachmentsDir,
    );
    downloadedAttachmentPaths = downloaded.map((filename) =>
      path.relative(repoRoot, path.join(attachmentsDir, filename)),
    );
    for (const failure of failed) {
      printWarn(
        `Failed to download attachment '${failure.name}': ${failure.error}. Continuing.`,
      );
    }
  }

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
  // because a Link-typed `feature_id_field` needs it below to write the ticket back. This is
  // a direct Lark call (not through `TicketSource`) — it syncs feature docs, not ticket state,
  // and reuses `source`'s already-fetched tenant token rather than fetching a second one.
  const featureRecordIds = new Map<string, string>();
  for (const featureId of featureIds) {
    const recordId = await syncFeatureToLarkTable(
      config,
      await source.getAccessToken(),
      featureId,
      newFeatureTitles.get(featureId) ?? ticket.title,
      ticket.projectRefs,
    );
    if (recordId) featureRecordIds.set(featureId, recordId);
  }

  if (ticketHadNoFeatureId && featureIds.length > 0) {
    await source.updateFeatureId(ticket, featureIds, featureRecordIds);
  }

  await source.updateStatus(ticket);

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
    ...(downloadedAttachmentPaths.length > 0
      ? { attachments: downloadedAttachmentPaths }
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
