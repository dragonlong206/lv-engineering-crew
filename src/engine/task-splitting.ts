import { Agent } from "@mastra/core/agent";
import { registerAgent } from "../mastra/index.js";
import { getModelForStep } from "../config.js";
import { extractText, extractJson } from "../cli/helpers.js";
import { buildTaskSplitPrompt } from "../prompts.js";
import type { Config } from "../types.js";

const taskSplitAgent = registerAgent(new Agent({
  id: "lv-task-split-agent",
  name: "LV Task Split Agent",
  model: "openai/gpt-4o-mini",
  instructions:
    "You are an assistant that judges whether a project change is too large or complex for a single change, and if so, splits it into distinct sub-tasks. Follow the user's prompt exactly and return only strict JSON — no surrounding text.",
}));

export interface TaskSplitSuggestion {
  shouldSplit: boolean;
  reason: string;
  subtasks: { title: string; description: string }[];
}

/**
 * Assesses whether a ticket's title/description describes work too large or complex for a
 * single `lv start` change, before any feature matching or branch creation happens. Always
 * returns `subtasks: []` when `shouldSplit` is false — callers don't need to separately check
 * both fields.
 */
export async function analyzeTaskComplexity(
  config: Config,
  title: string,
  description: string,
  thresholdHours: number,
): Promise<TaskSplitSuggestion> {
  const model = getModelForStep(config, "bootstrap");
  const result = await taskSplitAgent.generate(
    buildTaskSplitPrompt(title, description, thresholdHours),
    { model },
  );
  const parsed = extractJson<TaskSplitSuggestion>(extractText(result));
  return {
    shouldSplit: parsed.shouldSplit,
    reason: parsed.reason,
    subtasks: parsed.shouldSplit ? parsed.subtasks : [],
  };
}
