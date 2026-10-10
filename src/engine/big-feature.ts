import path from "path";
import yaml from "js-yaml";
import { findChangeBranches } from "./branch-naming.js";
import { getChangesDir } from "../config.js";
import { readFileAtRef } from "../integrations/git/client.js";
import { StateSchema, type Config } from "../types.js";

/**
 * Finds the big-feature branch of `parentId` — a branch for that change whose committed
 * `state.yaml` has `big_feature: true` (written by `lv start`'s big feature git flow). Checks the
 * local branch first, then `origin/`, so it also works when the branch exists only on the remote.
 * Returns `undefined` when the parent has no such branch.
 */
export async function findBigFeatureBranch(
  repoRoot: string,
  config: Config,
  parentId: string,
): Promise<string | undefined> {
  const stateFile = path.relative(
    repoRoot,
    path.join(getChangesDir(repoRoot, parentId), "state.yaml"),
  );
  for (const branch of await findChangeBranches(repoRoot, config, parentId)) {
    for (const ref of [branch, `origin/${branch}`]) {
      const raw = await readFileAtRef(repoRoot, ref, stateFile);
      if (raw === undefined) continue;
      const parsed = StateSchema.safeParse(yaml.load(raw));
      if (parsed.success && parsed.data.big_feature) return branch;
    }
  }
  return undefined;
}
