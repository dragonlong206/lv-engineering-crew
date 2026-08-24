import { z } from "zod";

export const StepStatusSchema = z.enum(["pending", "in_progress", "approved"]);
export type StepStatus = z.infer<typeof StepStatusSchema>;

export const StepRecordSchema = z.object({
  status: StepStatusSchema,
  iterations: z.number().int().nonnegative(),
  model: z.string(),
  tokens_in: z.number().int().nonnegative(),
  tokens_out: z.number().int().nonnegative(),
  duration_seconds: z.number().nonnegative(),
  approved_at: z.string().optional(),
});
export type StepRecord = z.infer<typeof StepRecordSchema>;

export const StateSchema = z.object({
  ticket_id: z.string(),
  feature_ids: z.array(z.string()),
  branch: z.string(),
  current_step: z.enum(["analysis", "design"]),
  steps: z.object({
    analysis: StepRecordSchema,
    design: StepRecordSchema.optional(),
  }),
  created_at: z.string(),
  lv_version: z.string(),
});
export type State = z.infer<typeof StateSchema>;

export const LarkConfigSchema = z.object({
  base_id: z.string(),
  table_id: z.string(),
  feature_id_field: z.string().default("Feature ID"),
});

export const ModelsConfigSchema = z.object({
  analysis: z.string().optional(),
  design: z.string().optional(),
  bootstrap: z.string().optional(),
});
export type ModelsConfig = z.infer<typeof ModelsConfigSchema>;

export const ConfigSchema = z.object({
  lark: LarkConfigSchema,
  default_branch: z.string().default("main"),
  model: z.string().default("openai/gpt-4o"),
  models: ModelsConfigSchema.optional(),
  lark_token: z.string().optional(),
  openai_api_key: z.string().optional(),
  anthropic_api_key: z.string().optional(),
});
export type Config = z.infer<typeof ConfigSchema>;

export type Step = "analysis" | "design";

export const STEPS: Step[] = ["analysis", "design"];

export const LV_VERSION = "0.1.0";
