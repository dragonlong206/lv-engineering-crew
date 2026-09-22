import { Agent } from "@mastra/core/agent";
import { registerAgent } from "../mastra/index.js";
import { getModelForStep } from "../config.js";
import { extractText, extractJson, confirmSelection } from "../cli/helpers.js";
import {
  buildFeatureMatchPrompt,
  buildFeatureSplitPrompt,
} from "../prompts.js";
import type { Config } from "../types.js";
import { listExistingFeatures, type ExistingFeature } from "./feature-id.js";

const featureMatchAgent = registerAgent(new Agent({
  id: "lv-feature-match-agent",
  name: "LV Feature Match Agent",
  model: "openai/gpt-4o-mini",
  instructions:
    "You are an assistant that matches project changes to existing features. Follow the user's prompt exactly and return only strict JSON — no surrounding text.",
}));

const featureSplitAgent = registerAgent(new Agent({
  id: "lv-feature-split-agent",
  name: "LV Feature Split Agent",
  model: "openai/gpt-4o-mini",
  instructions:
    "You are an assistant that splits a project change into the distinct new features it introduces. Follow the user's prompt exactly and return only strict JSON — no surrounding text.",
}));

/**
 * Suggests existing features the given change might belong to, so `lv start` can offer them
 * instead of defaulting straight to "this is new." Returns an empty array when there are no
 * existing features with docs to compare against (no LLM call is made in that case), when the
 * model found no confident matches, or when it returned only IDs outside the candidate list.
 */
export async function matchExistingFeature(
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
export async function inferFeatureSplit(
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
export async function confirmFeatureMatches(
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
