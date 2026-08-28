<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv start design

## Architecture and layers

`lv start` is a command-line orchestration flow that combines input parsing, optional Lark integration, branch naming, feature discovery, feature documentation bootstrapping, state persistence, and Git side effects.

The code is organized into these layers:

- Command registration in `src/index.ts`
- Workflow orchestration in `src/cli/start.ts`
- Configuration and repository path resolution in `src/config.ts`
- Ticket retrieval, ticket update, and feature-record sync in `src/tools/lark.ts`
- Branch naming and branch matching in `src/engine/branch-naming.ts`
- Feature ID allocation and feature discovery in `src/engine/feature-id.ts`
- Inline feature doc generation in `src/cli/bootstrap.ts`
- State persistence in `src/engine/state-io.ts`
- Git operations in `src/integrations/git/client.ts`

The ticket-based path is linear but has a decision point when no Feature ID is present. It first attempts to match the change against an existing feature, then falls back to inferring one or more new feature titles and allocating matching feature IDs. Missing feature docs are generated before the branch creation is finalized, and the user must confirm before the command proceeds. Description-based starts bypass Lark calls and use the free-text description to produce a change ID, branch name, and state file.

There is also a resume-aware path at the top of the flow. Before any Lark or LLM work, `lv start` checks whether a branch already exists for the change ID and either resumes it, restarts it by deleting the branch, or continues on the existing branch name when state is not yet present.

## Data model / schema

### Lark ticket data

`src/tools/lark.ts` defines the ticket shape used by `lv start`:

- `id`
- `title`
- `description`
- `featureIds: string[]`
- `projectRecordIds: string[]`
- `rawFields: Record<string, unknown>`
- `featureIdFieldIsLink: boolean`

`fetchTicket()` reads the ticket record from the configured Lark Base table, detects whether the configured Feature ID column is a link field by inspecting field metadata, and extracts feature IDs accordingly. For link fields, it reads linked record text from `text_arr`. For non-link fields, it accepts comma-separated strings or string arrays. It also extracts project link record IDs from the configured project field and preserves the raw record fields for later updates.

### Persisted state

`src/types.ts` defines `StateSchema`, which is written to `docs/changes/<change-id>/state.yaml` by `src/engine/state-io.ts`. For `lv start`, the state includes:

- `ticket_id` for ticket-based starts, omitted for description-based starts
- `title`
- `description`
- `feature_ids`
- `branch`
- `created_at`
- `lv_version`

### Configuration

The relevant configuration shape includes:

- `lark.base_id`
- `lark.table_id`
- `lark.feature_id_field`
- `lark.title_field`
- `lark.project_field`
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
- `branch_types`
- `feature_id_prefix`
- `feature_id_digits`
- `lark_app_id`
- `lark_app_secret`

## APIs / interfaces

The public entry point is `runStart(ticketId: string | undefined, opts: StartOptions = {}): Promise<void>` in `src/cli/start.ts`.

Key supporting functions and interfaces are:

- `getTenantAccessToken(appId, appSecret)` in `src/tools/lark.ts`
- `fetchTicket(ticketId, baseId, tableId, featureIdField, titleField, projectField, token)` in `src/tools/lark.ts`
- `updateTicketFeatureId(ticket, newFeatureIds, baseId, tableId, featureIdField, token, newFeatureRecordIds?)` in `src/tools/lark.ts`
- `updateTicketStatus(ticket, newStatus, baseId, tableId, statusField, token)` in `src/tools/lark.ts`
- `syncFeatureToLarkTable(config, larkToken, featureId, title, projectRecordIds?)` in `src/tools/lark.ts`
- `allocateFeatureIds(repoRoot, count, prefix, digits)` in `src/engine/feature-id.ts`
- `listExistingFeatures(repoRoot)` in `src/engine/feature-id.ts`
- `renderBranchName(config, ticketId, { type?, summary? })` in `src/engine/branch-naming.ts`
- `generateFeatureDocsFromScan(config, repoRoot, featureId, hint)` in `src/cli/bootstrap.ts`
- `writeState(repoRoot, changeId, state)` in `src/engine/state-io.ts`
- `createBranch(repoRoot, branchName, fromBranch)` in `src/integrations/git/client.ts`
- `checkoutBranch(repoRoot, branchName)` in `src/integrations/git/client.ts`
- `discardLocalBranch(repoRoot, branchName, fromBranch)` in `src/integrations/git/client.ts`
- `commitAll(repoRoot, message)` in `src/integrations/git/client.ts`
- `push(repoRoot, branchName)` in `src/integrations/git/client.ts`

`src/index.ts` exposes the command as `lv start [ticket-id]` with options `--type <type>` and `--description <description>`.

## Key design decisions

- Support both ticket-backed and free-text starts through one command so the change-context workflow stays consistent.
- Resolve the branch name from the ticket title only after the ticket is fetched, since the title is part of the branch summary.
- Treat a missing ticket Feature ID as a recoverable state rather than an error, and try to reuse existing feature docs before allocating new IDs.
- Allocate multiple feature IDs when inference suggests a split, rather than forcing every start to map to exactly one feature.
- Allow inline feature doc generation for missing feature directories so ticket-driven starts can bootstrap feature documentation in the same run.
- Pause for confirmation after generating docs, because those files are meant to be reviewed before they are committed.
- Use best-effort write-back to Lark for allocated Feature IDs and feature-table records, since write permissions may not always be available.
- Detect whether the ticket's Feature ID field is a Link field from Lark metadata, because link fields require resolved `record_id`s rather than plain text values.
- Update ticket status as a separate best-effort Lark write, and only when status syncing is enabled.
- Create the branch before writing state and committing so the resulting state and commit are anchored to the intended branch.
- Use a single YAML state file as the change-context source of truth.
- Stage all changes before commit, which means `lv start` can include unrelated uncommitted files if they exist in the working tree.
- Support resume-or-restart behavior up front so rerunning `lv start` on an in-progress change does not immediately fail on branch creation.