<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv start design

## Architecture and layers

`lv start` is a command-line orchestration flow that combines input parsing, optional Lark integration, branch naming, feature discovery, feature documentation bootstrapping, state persistence, and Git side effects.

The code is organized into these layers:

- Command registration in `src/index.ts`
- Workflow orchestration in `src/cli/start.ts`
- Configuration and repository path resolution in `src/config.ts`
- Ticket retrieval, ticket update, and feature-record sync in `src/tools/lark.ts`
- Branch naming and branch-pattern matching in `src/engine/branch-naming.ts`
- Feature ID allocation and feature discovery in `src/engine/feature-id.ts`
- Inline feature doc generation in `src/cli/bootstrap.ts`
- State persistence in `src/engine/state-io.ts`
- Git operations in `src/integrations/git/client.ts`

The ticket-based path is linear but has a decision point when no Feature ID is present on the ticket. It first attempts to match the change against an existing feature, then falls back to inferring one or more new feature titles and allocating matching feature IDs. Missing feature docs are generated before the branch creation is finalized, and the user must confirm before the command proceeds. Description-based starts bypass Lark calls and use the free-text description to produce a change ID, branch name, and state file.

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

`fetchTicket()` auto-detects whether the configured Lark feature field is a Bitable Link field by calling `isLinkField()`, which pages through the ticket table's field metadata (`GET .../fields`) and checks the matching field's numeric `type` against Lark's single-link/duplex-link type codes (18, 21) — rather than trusting a config flag or sniffing the shape of the field's current value, since an empty Link field and an empty text field read back identically and can't be told apart that way. When the field is a Link field, feature IDs are read from each linked record's `text_arr` (its primary-field text) instead of a comma-separated string/array. `featureIdFieldIsLink` is carried on the returned `LarkTicket` so `updateTicketFeatureId()` doesn't need to re-look it up. Writing back mirrors this: for a non-link field the write is a comma-joined string / string array; for a Link field, `updateTicketFeatureId()` writes an array of the linked Features-table rows' `record_id`s (resolved via `syncFeatureToLarkTable()`, which must run first for each feature ID being written) — writing plain text to a Link field fails with Lark error 1254067 `LinkFieldConvFail`. The title is read from the configured title field and falls back to the ticket ID if empty. The description is read from `Description` or `description` when present. Linked project record IDs are extracted from the configured project link field.

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
- `updateTicketFeatureId(ticket, newFeatureIds, baseId, tableId, featureIdField, token)` in `src/tools/lark.ts`
- `updateTicketStatus(ticket, newStatus, baseId, tableId, statusField, token)` in `src/tools/lark.ts`
- `syncFeatureToLarkTable(config, larkToken, featureId, title, projectRecordIds?)` in `src/tools/lark.ts`
- `allocateFeatureIds(repoRoot, count, prefix, digits)` in `src/engine/feature-id.ts`
- `listExistingFeatures(repoRoot)` in `src/engine/feature-id.ts`
- `renderBranchName(config, ticketId, { type?, summary? })` in `src/engine/branch-naming.ts`
- `generateFeatureDocsFromScan(config, repoRoot, featureId, hint)` in `src/cli/bootstrap.ts`
- `writeState(repoRoot, changeId, state)` in `src/engine/state-io.ts`
- `createBranch(repoRoot, branchName, fromBranch)` in `src/integrations/git/client.ts`
- `commitAll(repoRoot, message)` in `src/integrations/git/client.ts`

`src/index.ts` exposes the command as `lv start [ticket-id]` with options `--type <type>` and `--description <description>`.

## Key design decisions

- Support both ticket-backed and free-text starts through one command so the change-context workflow stays consistent.
- Defer branch rendering in ticket mode until after the ticket is fetched, because the ticket title is used as the branch summary.
- Treat a missing ticket Feature ID as a recoverable state rather than an error, and try to reuse existing feature docs before allocating new IDs.
- Allocate multiple feature IDs when inference suggests a split, rather than forcing every start to map to exactly one feature.
- Allow inline feature doc generation for missing feature directories so ticket-driven starts can bootstrap feature documentation in the same run.
- Pause for confirmation after generating docs, because those files are meant to be reviewed before they are committed.
- Use best-effort write-back to Lark for allocated Feature IDs and feature-table records, since write permissions may not always be available.
- Auto-detect (via the field's own Bitable metadata, not a config flag) whether the ticket's Feature ID field is plain text/multi-select or a Link field, since a Link field write requires resolved `record_id`s rather than text and would otherwise fail with Lark error 1254067 `LinkFieldConvFail` — and a config flag would need to be kept in sync with the base by hand, which is easy to forget.
- Update ticket status as a separate best-effort Lark write, and only when status syncing is enabled.
- Create the branch before writing state and committing so the resulting state and commit are anchored to the intended branch.
- Use a single YAML state file as the change-context source of truth.
- Stage all changes before commit, which means `lv start` can include unrelated uncommitted files if they exist in the working tree.