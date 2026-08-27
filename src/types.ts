import { z } from "zod";

// A change started from a Lark ticket sets `ticket_id`; a change started from a free-text
// description omits it. `description` is always populated (the ticket's description field,
// or the given free text) so OpenSpec's context pointer can read it uniformly either way.
export const StateSchema = z.object({
  ticket_id: z.string().optional(),
  title: z.string(),
  description: z.string(),
  feature_ids: z.array(z.string()),
  branch: z.string(),
  created_at: z.string(),
  lv_version: z.string(),
});
export type State = z.infer<typeof StateSchema>;

export const LarkConfigSchema = z.object({
  base_id: z.string(),
  table_id: z.string(),
  feature_id_field: z.string().default("Feature ID"),
  title_field: z.string().default("Title"),
  // Column holding the ticket's one-way/duplex link to the Projects table.
  project_field: z.string().default("Project"),
  // Whether `lv start` writes a newly allocated feature ID back to the ticket's
  // Feature ID field. Requires the app's tenant token to carry Bitable write scope.
  sync_feature_id: z.boolean().default(true),
  // Table in the same Lark Base to record every newly created feature in. Unset skips the
  // Features-table sync entirely, regardless of `sync_new_features`.
  features_table_id: z.string().optional(),
  // Whether `lv bootstrap`/`lv start` create a record in `features_table_id` for a brand-new
  // feature. Requires the app's tenant token to carry Bitable write scope.
  sync_new_features: z.boolean().default(true),
  // Column names in `features_table_id`. Defaults match a freshly created Features table;
  // override to match an existing table's actual column names. The Features table is
  // separate from the ticket/task table and has no ticket-reference column.
  features_table_feature_id_field: z.string().default("Feature ID"),
  features_table_title_field: z.string().default("Title"),
  // Column on the Features table holding its own link to the Projects table — populated
  // from the originating ticket's `project_field` link when a feature is created via
  // `lv start` for a ticket.
  features_table_project_field: z.string().default("Project"),
  // Column holding the ticket's status (a single-select field), read and written as a
  // plain string.
  status_field: z.string().default("Status"),
  // Value written to `status_field` by `lv start` once work begins.
  in_dev_status_value: z.string().default("In Dev"),
  // Whether `lv start` writes `in_dev_status_value` back to the ticket's status field when
  // it isn't already set to that value. Requires the app's tenant token to carry Bitable
  // write scope.
  sync_status: z.boolean().default(true),
});

export const ModelsConfigSchema = z.object({
  bootstrap: z.string().optional(),
});
export type ModelsConfig = z.infer<typeof ModelsConfigSchema>;

export const ConfigSchema = z.object({
  lark: LarkConfigSchema,
  default_branch: z.string().default("main"),
  model: z.string().default("openai/gpt-4o"),
  models: ModelsConfigSchema.optional(),
  feature_id_prefix: z.string().default("F"),
  feature_id_digits: z.number().int().positive().default(4),
  // Branch naming per type, e.g. { feature: "lv/{ticket_id}", hotfix: "hotfix/{ticket_id}" }.
  // Omit to use the built-in default (src/engine/branch-naming.ts).
  branch_types: z.record(z.string(), z.string()).optional(),
  default_branch_type: z.string().default("feature"),
  // Override which files `lv bootstrap`/`lv init` read from the target repo.
  // Omit either to use the built-in default list (src/tools/codebase.ts).
  scan_extensions: z.array(z.string()).optional(),
  scan_skip_dirs: z.array(z.string()).optional(),
  lark_app_id: z.string().optional(),
  lark_app_secret: z.string().optional(),
  openai_api_key: z.string().optional(),
  anthropic_api_key: z.string().optional(),
});
export type Config = z.infer<typeof ConfigSchema>;

export const LV_VERSION = "0.1.0";
