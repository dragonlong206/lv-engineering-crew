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
  // Names of the OpenSpec change(s) created for this LV change — not derivable from the
  // change ID by convention, and one LV change can spawn more than one OpenSpec change.
  // Populated by `lv link`, called by `/opsx:propose` after `openspec new change`.
  openspec_changes: z.array(z.string()).default([]),
  // The ticket's UI design reference(s) (Figma link, HTML prototype, image, or PDF), read
  // from `lark.ui_design_field` when configured. Omitted (not `[]`) when there's nothing to
  // record — see `normalizeUiDesignRefs()` in src/tools/lark.ts.
  ui_design: z.array(z.string()).optional(),
  // Repo-relative paths of the ticket's attachments (from `lark.attachment_field`),
  // downloaded by `lv start` into `docs/changes/<change-id>/attachments/`. Omitted (not
  // `[]`) when there's nothing to record — see `downloadTicketAttachments()` in
  // src/tools/lark.ts.
  attachments: z.array(z.string()).optional(),
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
  // Column holding a ticket's UI design reference (a Figma link, an HTML prototype, or an
  // attached image/PDF). Unset skips UI design capture entirely. May be a plain text/URL
  // field, a Lark attachment field, or a Lark URL-type field — normalized to a flat list of
  // reference strings regardless of shape.
  ui_design_field: z.string().optional(),
  // Column holding a ticket's attachments (documents, screenshots, or videos) as a Lark
  // attachment field. Unset skips attachment capture entirely. Unlike `ui_design_field`,
  // `lv start` downloads each file's content (not just a reference) into
  // `docs/changes/<change-id>/attachments/`.
  attachment_field: z.string().optional(),
  // Column holding the ticket's status (a single-select field), read and written as a
  // plain string.
  status_field: z.string().default("Status"),
  // Value written to `status_field` by `lv start` once work begins.
  in_dev_status_value: z.string().default("In Dev"),
  // Whether `lv start` writes `in_dev_status_value` back to the ticket's status field when
  // it isn't already set to that value. Requires the app's tenant token to carry Bitable
  // write scope.
  sync_status: z.boolean().default(true),
  // Column holding a sub-ticket's link back to its parent ticket (a Bitable Link field on the
  // same ticket table `lv start` reads from). Unset skips writing the relationship when a
  // ticket is split into sub-tasks — the sub-tickets are still created either way.
  subtask_parent_field: z.string().optional(),
});

export const ModelsConfigSchema = z.object({
  bootstrap: z.string().optional(),
});
export type ModelsConfig = z.infer<typeof ModelsConfigSchema>;

// Controls `lv start <ticket-id>`'s pre-branch complexity analysis — whether a ticket looks
// too large/complex to implement as a single change, and should be split into sub-tickets
// instead. Not nested under `lark:` because the analysis itself only reads the ticket's
// title/description; only the resulting sub-ticket creation talks to Lark.
export const TaskSplittingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  threshold_hours: z.number().positive().default(4),
});
export type TaskSplittingConfig = z.infer<typeof TaskSplittingConfigSchema>;

// `apply_model` is a Claude Code model alias/id (e.g. "haiku"), consumed by `lv init` to pin the
// generated `/opsx:apply` command's frontmatter — a different runtime and value format from
// `models` above (Mastra "provider/model" strings for LV's own agents). Unset leaves the
// generated command's model unpinned.
export const OpenSpecConfigSchema = z.object({
  apply_model: z.string().optional(),
});
export type OpenSpecConfig = z.infer<typeof OpenSpecConfigSchema>;

// Whether Mastra agent runs are traced (observability wired to the shared `mastra` instance
// in src/mastra.ts). Defaults to enabled — see isTracingEnabled() in src/config.ts.
export const TracingConfigSchema = z.object({
  enabled: z.boolean().default(true),
});
export type TracingConfig = z.infer<typeof TracingConfigSchema>;

export const ConfigSchema = z.object({
  lark: LarkConfigSchema,
  default_branch: z.string().default("main"),
  model: z.string().default("openai/gpt-4o"),
  models: ModelsConfigSchema.optional(),
  tracing: TracingConfigSchema.optional(),
  // Whether/how `lv start <ticket-id>` analyzes a ticket for complexity before creating a
  // branch, and offers to split it into sub-tickets. Omit for the defaults (enabled, 4h).
  task_splitting: TaskSplittingConfigSchema.optional(),
  // `.nullish()`, not `.optional()`: a `.lv.yaml` block with every child commented out (as the
  // shipped template's `openspec:` is by default) parses as `openspec: null`, not a missing key.
  openspec: OpenSpecConfigSchema.nullish(),
  feature_id_prefix: z.string().default("F"),
  feature_id_digits: z.number().int().positive().default(4),
  // Branch naming per type, e.g. { feature: "lv/{ticket_id}", hotfix: "hotfix/{ticket_id}" }.
  // Omit to use the built-in default (src/engine/branch-naming.ts). An entry may also be an
  // object with a `base_branch` to fork that type's branches from something other than
  // `default_branch` (e.g. hotfix from "master" while feature forks from "develop").
  branch_types: z
    .record(
      z.string(),
      z.union([
        z.string(),
        z.object({ pattern: z.string(), base_branch: z.string().optional() }),
      ]),
    )
    .optional(),
  default_branch_type: z.string().default("feature"),
  // Override which files `lv bootstrap`/`lv init` read from the target repo.
  // Omit either to use the built-in default list (src/tools/codebase.ts).
  scan_extensions: z.array(z.string()).optional(),
  scan_skip_dirs: z.array(z.string()).optional(),
  lark_app_id: z.string().optional(),
  lark_app_secret: z.string().optional(),
  openai_api_key: z.string().optional(),
  anthropic_api_key: z.string().optional(),
  // Language (e.g. "Vietnamese", "English") that generated artifact prose — both OpenSpec
  // workflow output and `lv bootstrap`'s own docs — should be written in. Free text, passed
  // through to the LLM as-is; unset means no language constraint (current behavior).
  output_language: z.string().optional(),
});
export type Config = z.infer<typeof ConfigSchema>;

export const LV_VERSION = "0.1.0";
