import {
  checkoutBranch,
  discardLocalBranch,
} from "../integrations/git/client.js";
import { readState, stateExists } from "./state-io.js";
import { findChangeBranches } from "./branch-naming.js";
import {
  printInfo,
  printSuccess,
  promptSelect,
  promptResumeOrRestart,
} from "../cli/helpers.js";
import { printStateSummary } from "../cli/status.js";
import type { Config } from "../types.js";

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
export async function resolveExistingBranch(
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
