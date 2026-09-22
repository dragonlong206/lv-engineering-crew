#!/usr/bin/env node
// Resolves a merged PR's source branch to its `docs/changes/<change-id>/state.yaml`,
// and prints the linked OpenSpec change names and feature IDs for the archive-on-merge
// workflow. See openspec/changes/auto-archive-sync-on-merge/design.md.
import { readFileSync, appendFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

function resolveMergedBranch() {
  const branch = process.argv[2] ?? process.env.MERGED_BRANCH;
  if (!branch) {
    console.error("Usage: resolve-merged-change.mjs <branch-name> (or set MERGED_BRANCH)");
    process.exit(1);
  }
  return branch;
}

function findMatchingState(changesDir, branch) {
  if (!existsSync(changesDir)) return null;
  for (const changeId of readdirSync(changesDir)) {
    const statePath = join(changesDir, changeId, "state.yaml");
    if (!existsSync(statePath)) continue;
    const state = yaml.load(readFileSync(statePath, "utf8"));
    if (state?.branch === branch) {
      return { changeId, state };
    }
  }
  return null;
}

function writeOutputs(outputs) {
  const githubOutput = process.env.GITHUB_OUTPUT;
  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
  if (githubOutput) {
    appendFileSync(githubOutput, lines.join("\n") + "\n");
  } else {
    for (const line of lines) console.log(line);
  }
}

const branch = resolveMergedBranch();
const changesDir = join(process.cwd(), "docs", "changes");
const match = findMatchingState(changesDir, branch);

if (!match) {
  console.error(`No docs/changes/*/state.yaml found with branch '${branch}' — nothing to archive.`);
  writeOutputs({ "change-id": "", "openspec-changes": "[]", "feature-ids": "[]" });
  process.exit(0);
}

const { changeId, state } = match;
const openspecChanges = state.openspec_changes ?? [];
const featureIds = state.feature_ids ?? [];

console.error(
  `Resolved branch '${branch}' -> change '${changeId}' (openspec_changes: ${openspecChanges.length}, feature_ids: ${featureIds.length})`
);

writeOutputs({
  "change-id": changeId,
  "openspec-changes": JSON.stringify(openspecChanges),
  "feature-ids": JSON.stringify(featureIds),
});
