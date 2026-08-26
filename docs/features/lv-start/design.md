<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv start design

## Architecture and layers

`lv start` is a command-line orchestration flow that combines configuration loading, ticket or description intake, branch naming, inline feature bootstrapping, state persistence, and Git side effects.

The code is organized into these layers:

- Command registration in `src/index.ts`
- Workflow orchestration in `src/cli/start.ts`
- Configuration and repository path resolution in `src/config.ts`
- Ticket retrieval and feature ID write-back in `src/tools/lark.ts`
- Branch naming in `src/engine/branch-naming.ts`
- Feature ID allocation in `src/engine/feature-id.ts`
- Feature doc generation in `src/cli/bootstrap.ts`
- State persistence in `src/engine/state-io.ts`
- Git operations in `src/integrations/git/client.ts`

The flow is mostly linear. Ticket-based starts validate Lark credentials, fetch the ticket, resolve branch naming, optionally allocate a feature ID, optionally generate docs for missing feature directories, optionally sync the feature ID back to Lark, create the branch, write state, commit, and push. Description-based starts skip Lark entirely and use the description to derive both the change ID and branch summary.

## Data model / schema

### Lark ticket data

`src/tools/lark.ts` exposes a ticket shape with these fields:

- `id`
- `title`
- `description`
- `featureIds: string[]`
- `rawFields: Record<string, unknown>`

Feature IDs are read from the configured Lark feature field as either a comma-separated string or an array of strings. Empty values are ignored. The ticket title is read from the configured title field, falling back to the ticket ID when empty. The description is read from a `Description` or `description` field when present.

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

The relevant config shape includes:

- `lark.base_id`
- `lark.table_id`
- `lark.feature_id_field`
- `lark.title_field`
- `lark.sync_feature_id`
- `default_branch`
- `default_branch_type`
- `branch_types`
- `feature_id_prefix`
- `feature_id_digits`

## APIs / interfaces

The public command entry point is `runStart(ticketId: string | undefined, opts: StartOptions = {}): Promise<void>` in `src/cli/start.ts`.

Key supporting functions and interfaces are:

- `getTenantAccessToken(appId, appSecret)` in `src/tools/lark.ts`
- `fetchTicket(ticketId, baseId, tableId, featureIdField, titleField, token)` in `src/tools/lark.ts`
- `updateTicketFeatureId(ticket, newFeatureId, baseId, tableId, featureIdField, token)` in `src/tools/lark.ts`
- `allocateFeatureIds(repoRoot, count, prefix, digits)` in `src/engine/feature-id.ts`
- `renderBranchName(config, ticketId, { type?, summary? })` in `src/engine/branch-naming.ts`
- `generateFeatureDocsFromScan(config, repoRoot, featureId, hint?)` in `src/cli/bootstrap.ts`
- `writeState(repoRoot, changeId, state)` in `src/engine/state-io.ts`
- `createBranch(repoRoot, branchName, fromBranch)` in `src/integrations/git/client.ts`
- `commitAll(repoRoot, message)` and `push(repoRoot, branchName)` in `src/integrations/git/client.ts`

`src/index.ts` exposes the command as `lv start [ticket-id]` with options `--type <type>` and `--description <description>`.

## Key design decisions

- Support both ticket-backed and free-text starts in one command entry point, so the same state and branch workflow can be used with or without Lark.
- Derive the branch name only after the ticket is fetched, because the title used for the summary comes from Lark.
- Treat an empty ticket Feature ID field as a request to allocate exactly one new feature ID, rather than failing immediately.
- Generate missing feature docs inline from a repo scan before branch creation, then gate continuation on user confirmation so unreviewed docs are not silently committed.
- Attempt to sync a newly allocated Feature ID back to Lark only as a best-effort side effect, because write permission may not be available.
- Create the branch before writing state and committing so the resulting work is anchored on the intended ticket branch.
- Use a single YAML state file as the source of truth for the change context.
- Stage all changes before commit, which means `lv start` can capture unrelated dirty files if they exist in the working tree.
- Treat push as best effort so local workflows continue even when no remote or network is available.