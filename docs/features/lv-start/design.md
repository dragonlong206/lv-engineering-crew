<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv start design

## Architecture and layers

`lv start` is an orchestration command that combines input parsing, optional Lark integration, branch naming, feature discovery, feature documentation bootstrapping, state persistence, and Git side effects.

The code is organized into these layers:

- Command registration in `src/index.ts`
- Workflow orchestration in `src/cli/start.ts`
- Configuration and repository path resolution in `src/config.ts`
- Ticket retrieval, ticket update, and feature-record sync in `src/tools/lark.ts`
- Branch naming, branch rendering, branch matching, and branch discovery in `src/engine/branch-naming.ts`
- Feature ID allocation and existing feature discovery in `src/engine/feature-id.ts`
- Placeholder feature doc generation in `src/cli/bootstrap.ts`
- State persistence in `src/engine/state-io.ts`
- Git operations in `src/integrations/git/client.ts`
- Shared interactive prompting and JSON parsing helpers in `src/cli/helpers.ts`
- Prompt construction and LLM-assisted feature matching/splitting in `src/prompts.ts` and `src/cli/start.ts`

The workflow has three major control paths:

- Ticket-based start, which fetches Lark data and may write back to Lark.
- Description-based start, which avoids Lark and uses free text to build the change context.
- Resume-aware start, which detects existing branches for the same change ID and lets the engineer resume or restart before any external side effects happen.

Within the ticket-based path, there is a decision point when the ticket has no Feature ID. The command first tries to match the change against existing features, then falls back to inferring one or more new feature titles and allocating matching feature IDs. If any referenced feature directory is missing locally, placeholder feature docs are generated inline and the command asks for confirmation before it proceeds. Those generated docs are then treated the same as other feature docs for subsequent Lark sync.

## Data model / schema

### Lark ticket data

`src/tools/lark.ts` defines the ticket shape used by `lv start`:

- `id`
- `title`
- `description`
- `featureIds: string[]`
- `projectRecordIds: string[]`
- `uiDesignRefs: string[]`
- `rawFields: Record<string, unknown>`
- `featureIdFieldIsLink: boolean`

`fetchTicket()` reads the record from the configured Lark Base table, checks whether the configured Feature ID column is a Bitable Link field by inspecting field metadata, and extracts feature IDs accordingly. For link fields it reads linked record text from `text_arr`; for non-link fields it accepts comma-separated strings or string arrays. It also extracts project link record IDs from the configured project field, normalizes UI design references when configured, and preserves the raw fields for later updates.

### Persisted state

`src/types.ts` defines `StateSchema`, which is written to `docs/changes/<change-id>/state.yaml` by `src/engine/state-io.ts`. For `lv start`, the state includes:

- `ticket_id` for ticket-based starts, omitted for description-based starts
- `title`
- `description`
- `feature_ids`
- `branch`
- `created_at`
- `lv_version`
- `openspec_changes` with a default of `[]`
- optional `ui_design`

`writeState()` creates the `docs/changes/<change-id>/` directory if needed and serializes the schema as YAML. `readState()` is used during resume handling to determine whether the branch already has persisted context.

### Configuration

The relevant configuration shape includes:

- `lark.base_id`
- `lark.table_id`
- `lark.feature_id_field`
- `lark.title_field`
- `lark.project_field`
- `lark.ui_design_field`
- `lark.sync_feature_id`
- `lark.features_table_id`
- `lark.sync_new_features`
- `lark.features_table_feature_id_field`
- `lark.features_table_title_field`
- `lark.features_table_project_field`
- `lark.status_field`
- `lark.in_dev_status_value`
- `lark.sync_status`
- `default_branch`
- `default_branch_type`
- `branch_types` - each entry is either a plain naming-pattern string, or `{ pattern, base_branch? }` to fork that type's branches from something other than `default_branch`
- `feature_id_prefix`
- `feature_id_digits`
- `lark_app_id`
- `lark_app_secret`

## APIs / interfaces

The public entry point is `runStart(ticketId: string | undefined, opts: StartOptions = {}): Promise<void>` in `src/cli/start.ts`.

Key supporting functions and interfaces are:

- `getTenantAccessToken(appId, appSecret)` in `src/tools/lark.ts`
- `fetchTicket(ticketId, baseId, tableId, featureIdField, titleField, projectField, token, uiDesignField?)` in `src/tools/lark.ts`
- `updateTicketFeatureId(ticket, newFeatureIds, baseId, tableId, featureIdField, token, newFeatureRecordIds?)` in `src/tools/lark.ts`
- `updateTicketStatus(ticket, newStatus, baseId, tableId, statusField, token)` in `src/tools/lark.ts`
- `syncFeatureToLarkTable(config, larkToken, featureId, title, projectRecordIds?)` in `src/tools/lark.ts`
- `allocateFeatureIds(repoRoot, count, prefix, digits)` in `src/engine/feature-id.ts`
- `listExistingFeatures(repoRoot)` in `src/engine/feature-id.ts`
- `renderBranchName(config, ticketId, { type?, summary? })` in `src/engine/branch-naming.ts`
- `resolveBaseBranch(config, type)` in `src/engine/branch-naming.ts`
- `findChangeBranches(repoRoot, config, changeId)` in `src/engine/branch-naming.ts`
- `createBranch(repoRoot, branchName, fromBranch)` in `src/integrations/git/client.ts`
- `checkoutBranch(repoRoot, branchName)` in `src/integrations/git/client.ts`
- `discardLocalBranch(repoRoot, branchName, fromBranch)` in `src/integrations/git/client.ts`
- `commitAll(repoRoot, message)` in `src/integrations/git/client.ts`
- `push(repoRoot, branchName)` in `src/integrations/git/client.ts`
- `writeState(repoRoot, changeId, state)` in `src/engine/state-io.ts`
- `confirmSelection()` and `confirmFeatureSplit()` in `src/cli/helpers.ts`
- `generateFeatureDocsPlaceholder(repoRoot, featureId)` in `src/cli/bootstrap.ts`
- `buildFeatureMatchPrompt()` and `buildFeatureSplitPrompt()` in `src/prompts.ts`

`src/index.ts` exposes the command as `lv start [ticket-id]` with options `--type <type>` and `--description <description>`.

## Key design decisions

- Support both ticket-backed and free-text starts through one command so the change-context workflow stays consistent.
- Resolve the branch name after loading the ticket, because the ticket title is part of the rendered branch summary.
- Treat a missing ticket Feature ID as recoverable instead of failing the command, and try to reuse existing feature docs before allocating new IDs.
- Allow multiple feature IDs when the change appears to span multiple new features, rather than forcing every start to map to exactly one feature.
- Generate placeholder feature docs for missing feature directories so ticket-driven starts can bootstrap documentation in the same run.
- Pause for confirmation after generating docs, because those files are intended to be reviewed before commit.
- Sync features to the Lark Features table independently of ticket write-back, so existing docs can still be backfilled into Lark.
- Detect whether the ticket Feature ID column is a Link field from Lark metadata, because link fields require resolved record IDs rather than plain text values.
- Perform ticket status update as a separate best-effort write and only when status syncing is enabled.
- Check for existing branches before Lark or feature-matching work so rerunning `lv start` on an in-progress change can resume cheaply.
- Resolve the base branch (`resolveBaseBranch()`) from the branch type being started, `--type` or `default_branch_type` if omitted, before checking for an existing branch, so both a fresh `createBranch()` and a restart's `discardLocalBranch()` plus recreate fork from the same type-specific base branch instead of always `default_branch`.
- Create the branch before writing state and committing so the resulting context is anchored to the intended branch.
- Use a single YAML state file as the source of truth for the change context.
- Stage all changes before commit, which means `lv start` can include unrelated dirty files if they are present in the working tree.
- Keep Lark writes non-fatal so the local LV context can still be created even when ticket sync or feature-table sync fails.
- Use LLM-assisted matching and splitting only when existing feature docs are available or when a ticket lacks an explicit Feature ID, so `lv start` can remain automated without forcing a manual mapping step.
- Preserve optional UI design references from Lark into persisted state so downstream OpenSpec steps can reuse them.