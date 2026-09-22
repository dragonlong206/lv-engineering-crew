<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv start design

## Architecture and layers

`lv start` is an orchestration command that combines input parsing, optional ticket-source integration, pre-branch complexity analysis, branch naming, feature discovery, feature documentation bootstrapping, state persistence, attachment download, and Git side effects. `src/cli/start.ts` itself only composes collaborators — it holds no Lark-specific code, no Mastra `Agent` construction, and no interactive branch-resume prompting logic; those live in their own modules (SOLID: each has one reason to change).

The code is organized into these layers:

- Command registration in `src/index.ts`
- Workflow orchestration (composition only) in `src/cli/start.ts`
- Configuration and repository path resolution in `src/config.ts`
- A source-agnostic ticket abstraction in `src/integrations/tickets/types.ts` (`Ticket`, `TicketSource`), with the Lark implementation in `src/integrations/tickets/lark-ticket-source.ts`
- Raw Lark Bitable API access — ticket fetch, ticket update, sub-ticket creation, attachment download, feature-record sync — in `src/tools/lark.ts` (no knowledge of `TicketSource`)
- Feature-match/split LLM agents and confirmation prompts in `src/engine/feature-matching.ts`
- Task-splitting complexity analysis in `src/engine/task-splitting.ts`
- Existing-branch resume/restart handling in `src/engine/branch-resolution.ts`
- Branch naming, branch rendering, branch matching, and branch discovery in `src/engine/branch-naming.ts`
- Feature ID allocation and existing feature discovery in `src/engine/feature-id.ts`
- Placeholder feature doc generation in `src/cli/bootstrap.ts`
- State persistence in `src/engine/state-io.ts`
- Git operations in `src/integrations/git/client.ts`
- Shared interactive prompting and JSON parsing helpers in `src/cli/helpers.ts`
- Prompt construction in `src/prompts.ts`

The workflow has three major control paths:

- Ticket-based start, which fetches data through a `TicketSource`, may run task-splitting analysis, may download ticket attachments, and may write back to the ticket source.
- Description-based start, which needs no `TicketSource` and uses free text to build the change context. Task-splitting analysis does not run for this path (see Non-Goals below).
- Resume-aware start (`resolveExistingBranch()`), which detects existing branches for the same change ID and lets the engineer resume or restart before any external side effects happen — this runs first, before any ticket-source, task-splitting, or LLM work, for both control paths above.

Within the ticket-based path, once a fresh ticket is fetched, there is a decision point for task-splitting analysis (see "Task-splitting analysis" below) before anything else. Only after that (analysis found no need to split, or the engineer declined the suggested split) does the existing decision point run: when the ticket has no Feature ID, the command first tries to match the change against existing features (`src/engine/feature-matching.ts`), then falls back to inferring one or more new feature titles and allocating matching feature IDs. If any referenced feature directory is missing locally, placeholder feature docs are generated inline and the command asks for confirmation before it proceeds. Those generated docs are then treated the same as other feature docs for subsequent Lark sync.

### The `TicketSource` seam

`startFromTicket()` depends on the `TicketSource` interface, not on `src/tools/lark.ts` directly (Dependency Inversion). `createLarkTicketSource(config)` is the only implementation today; it:

- owns the Lark credential check and the `"Fetching ticket ... from Lark Base..."` message, both inside `fetch()`
- caches one tenant-access-token for the lifetime of the source instance (one per `lv start` invocation), matching the "token fetched fresh per CLI invocation" behavior
- owns each write-back method's enabled/disabled branching and all of its console messaging (`updateFeatureId()`'s `lark.sync_feature_id` branch, `updateStatus()`'s `lark.sync_status` branch and current-status comparison, `createSubtickets()`'s `lark.subtask_parent_field`-unset warning) — each source is expected to word its own outcomes
- exposes one Lark-only extra beyond the `TicketSource` interface, `getAccessToken()`, on its concrete return type (`LarkTicketSourceHandle`) — used only by `syncFeatureToLarkTable()`'s direct call in `startFromTicket()`, so that call reuses this invocation's one token fetch instead of triggering a second one

`syncFeatureToLarkTable()` (feature docs → Lark Features table sync, also used by `lv bootstrap`) is deliberately **not** part of `TicketSource` — it syncs feature documentation, not ticket state, and is orthogonal to which system tracks the ticket itself. `startFromTicket()` still calls it directly against `src/tools/lark.ts`.

No second `TicketSource` implementation exists, and there is no `.lv.yaml` key to select one — `startFromTicket()` constructs `createLarkTicketSource(config)` directly, a single line. Adding a second ticket system means writing one new file that implements `TicketSource` (including `createSubtickets()`) and swapping (or switching on) that one construction line, not touching `startFromTicket()`'s control flow.

### Task-splitting analysis

`analyzeTaskComplexity()` (`src/engine/task-splitting.ts`) reads only the fetched ticket's title/description and asks a throwaway single-shot LLM agent (`taskSplitAgent`, same shape as `featureMatchAgent`/`featureSplitAgent`) whether the ticket is too large/complex for a single change. It runs immediately after `source.fetch(ticketId)` and before attachment download or feature matching — before attachment download so a ticket about to be split doesn't waste a download, and before feature matching so a parent ticket about to be abandoned in favor of its sub-tasks doesn't get its own (soon-irrelevant) feature IDs guessed.

If the model recommends splitting, `confirmTaskSplit()` (`src/cli/helpers.ts`) shows the reason and the suggested sub-tasks and asks a single accept-or-decline question — not a per-item multi-select like `confirmSelection()`/`confirmFeatureMatches()`, since a sub-task carries both a title and a description (doesn't fit a comma-separated-list edit), and letting the engineer accept only part of a split ticket would silently drop scope from the original ticket rather than just refining wording. On confirmation, `source.createSubtickets()` creates one ticket-table record per sub-task (title + description, plus the configured relationship field when set) and `startFromTicket()` returns immediately after printing guidance — no attachment download, feature matching, or branch/state/commit for the parent ticket. On decline, or when the model finds no need to split, `startFromTicket()` falls through to the rest of the flow exactly as it ran before this analysis existed.

## Data model / schema

### Source-agnostic ticket (`src/integrations/tickets/types.ts`)

```ts
interface Ticket {
  id: string;
  title: string;
  description: string;
  featureIds: string[];
  uiDesignRefs: string[];
  attachments: { fileToken: string; name: string }[];
  projectRefs: string[]; // opaque; meaningful only to the source that produced it
  raw: unknown;          // opaque source-specific state a write-back method may need back
}

interface TicketSource {
  fetch(ticketId: string): Promise<Ticket>;
  downloadAttachments(ticket: Ticket, destDir: string): Promise<{ downloaded: string[]; failed: { name: string; error: string }[] }>;
  updateFeatureId(ticket: Ticket, featureIds: string[], featureRecordIds: Map<string, string>): Promise<void>;
  updateStatus(ticket: Ticket): Promise<void>;
  createSubtickets(
    parent: Ticket,
    subtasks: { title: string; description: string }[],
  ): Promise<{
    created: { id: string; title: string }[];
    failed: { title: string; error: string }[];
  }>;
}
```

`LarkTicketSourceHandle extends TicketSource` adds `getAccessToken(): Promise<string>` (Lark-only, see above).

### Task-split suggestion (`src/engine/task-splitting.ts`)

```ts
interface TaskSplitSuggestion {
  shouldSplit: boolean;
  reason: string;
  subtasks: { title: string; description: string }[]; // always [] when shouldSplit is false
}
```

### Lark ticket data (`src/tools/lark.ts`, internal to `LarkTicketSource`)

`src/tools/lark.ts` still defines its own richer `LarkTicket` shape:

- `id`
- `title`
- `description`
- `featureIds: string[]`
- `projectRecordIds: string[]`
- `uiDesignRefs: string[]`
- `attachments: { fileToken: string; name: string }[]`
- `rawFields: Record<string, unknown>`
- `featureIdFieldIsLink: boolean`

`fetchTicket()` reads the record from the configured Lark Base table, checks whether the configured Feature ID column is a Bitable Link field by inspecting field metadata, and extracts feature IDs accordingly. For link fields it reads linked record text from `text_arr`; for non-link fields it accepts comma-separated strings or string arrays. It also extracts project link record IDs from the configured project field, normalizes UI design references when configured, extracts attachment metadata when configured, and preserves the raw fields for later updates.

`createLarkTicketSource()`'s `fetch()` adapts a `LarkTicket` into the generic `Ticket` shape: `projectRecordIds` → `projectRefs`, and the whole `LarkTicket` is stashed opaquely on `Ticket.raw` so `updateFeatureId()`/`updateStatus()` can read `featureIdFieldIsLink`/`rawFields` back out (cast internally; never read outside this module). `createSubtickets()` reads only `parent.id` (the Lark record ID) off the generic `Ticket`, needing nothing from `raw`.

`createSubticket()` (`src/tools/lark.ts`) POSTs a new record directly to the ticket table (not a separate table): the configured title field, a hardcoded `'Description'` field (mirroring `fetchTicket()`'s own hardcoded read of that column — there's no configurable description-field name to reuse), and, when a relationship field name is given, that field set to `[parentTicketId]`. It returns the created record's `record_id` and throws on failure; `LarkTicketSource.createSubtickets()` is the non-fatal, per-sub-task wrapper (parallel to `createFeatureRecord()` vs. `syncFeatureToLarkTable()`).

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
- optional `attachments`

`writeState()` creates the `docs/changes/<change-id>/` directory if needed and serializes the schema as YAML. `readState()` is used during resume handling (`src/engine/branch-resolution.ts`) to determine whether the branch already has persisted context. A confirmed split never reaches `writeState()` for the parent ticket — no state file is written for it.

### Configuration

The relevant configuration shape includes:

- `lark.base_id`
- `lark.table_id`
- `lark.feature_id_field`
- `lark.title_field`
- `lark.project_field`
- `lark.ui_design_field`
- `lark.attachment_field`
- `lark.sync_feature_id`
- `lark.features_table_id`
- `lark.sync_new_features`
- `lark.features_table_feature_id_field`
- `lark.features_table_title_field`
- `lark.features_table_project_field`
- `lark.status_field`
- `lark.in_dev_status_value`
- `lark.sync_status`
- `lark.subtask_parent_field` (optional; Link field name for a sub-ticket's relationship back to its parent)
- `default_branch`
- `default_branch_type`
- `branch_types`, where each entry is either a plain naming-pattern string or `{ pattern, base_branch? }`
- `feature_id_prefix`
- `feature_id_digits`
- `lark_app_id`
- `lark_app_secret`
- `task_splitting.enabled` (default `true`)
- `task_splitting.threshold_hours` (default `4`)

`task_splitting.*` lives at the top level, not under `lark:`, because the complexity analysis itself only reads the ticket's title/description — only the resulting sub-ticket creation talks to Lark. `ConfigSchema.lark` is still required and still Lark-shaped; making it pluggable per ticket source is explicitly out of scope until a second source exists.

## APIs / interfaces

The public entry point is `runStart(ticketId: string | undefined, opts: StartOptions = {}): Promise<void>` in `src/cli/start.ts`.

Key supporting functions and interfaces are:

- `Ticket`, `TicketSource` in `src/integrations/tickets/types.ts`
- `createLarkTicketSource(config): LarkTicketSourceHandle` in `src/integrations/tickets/lark-ticket-source.ts`
- `getTenantAccessToken(appId, appSecret)` in `src/tools/lark.ts`
- `fetchTicket(ticketId, baseId, tableId, featureIdField, titleField, projectField, token, uiDesignField?, attachmentField?)` in `src/tools/lark.ts`
- `downloadTicketAttachments(attachments, destDir, token)` in `src/tools/lark.ts`
- `updateTicketFeatureId(ticket, newFeatureIds, baseId, tableId, featureIdField, token, newFeatureRecordIds?)` in `src/tools/lark.ts`
- `updateTicketStatus(ticket, newStatus, baseId, tableId, statusField, token)` in `src/tools/lark.ts`
- `createSubticket(title, description, parentTicketId, baseId, tableId, titleField, token, subtaskParentField?)` in `src/tools/lark.ts`
- `syncFeatureToLarkTable(config, larkToken, featureId, title, projectRecordIds?)` in `src/tools/lark.ts`
- `matchExistingFeature()`, `inferFeatureSplit()`, `confirmFeatureMatches()` in `src/engine/feature-matching.ts`
- `analyzeTaskComplexity(config, title, description, thresholdHours)` in `src/engine/task-splitting.ts`
- `resolveExistingBranch(repoRoot, config, changeId, baseBranch)` in `src/engine/branch-resolution.ts`
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
- `confirmSelection()`, `confirmFeatureSplit()`, `confirmTaskSplit()` in `src/cli/helpers.ts`
- `generateFeatureDocsPlaceholder(repoRoot, featureId)` in `src/cli/bootstrap.ts`
- `buildFeatureMatchPrompt()`, `buildFeatureSplitPrompt()`, `buildTaskSplitPrompt()` in `src/prompts.ts`

`src/index.ts` exposes the command as `lv start [ticket-id]` with options `--type <type>` and `--description <description>`.

## Key design decisions

- Support both ticket-backed and free-text starts through one command so the change-context workflow stays consistent.
- Put a `TicketSource` interface between `lv start`'s orchestration and Lark specifically (Dependency Inversion), so a future second ticket system is a new file implementing the interface, not a change to `startFromTicket()`'s control flow (Open/Closed) — without implementing that second source or a config-driven selector now (YAGNI: no second consumer to justify it yet).
- Give ticket I/O, feature matching, task-splitting analysis, and branch resolution each their own module (Single Responsibility) instead of inlining all of it in `startFromTicket()`/`startFromDescription()` — `src/integrations/tickets/`, `src/engine/feature-matching.ts`, `src/engine/task-splitting.ts`, `src/engine/branch-resolution.ts` respectively.
- Move a Lark write-back's enabled/disabled branching and console messaging into `LarkTicketSource` itself, not `start.ts`, so each concrete source can word its own outcomes appropriately; `start.ts` just calls `source.updateFeatureId()`/`source.updateStatus()`/`source.createSubtickets()` unconditionally when it decides the write is worth attempting.
- Keep `syncFeatureToLarkTable()` out of `TicketSource` and called directly from `start.ts` — it syncs feature docs, not ticket state, and is orthogonal to which system tracks the ticket. Expose the `TicketSource`'s cached token to it via one Lark-only extra method (`getAccessToken()`) on the concrete return type, rather than fetching a second token.
- Run task-splitting analysis before feature matching/branch creation, reusing `models.bootstrap` (not a new per-step model key) for the same reason `matchExistingFeature()`/`inferFeatureSplit()` do — it's a single-shot classifier call in the same class as those.
- Ask one accept-or-decline question for a suggested split rather than a multi-select — a sub-task's title+description doesn't fit the existing comma-separated-list editing pattern, and partial acceptance risks silently dropping scope.
- Make the sub-ticket relationship field (`lark.subtask_parent_field`) optional, matching `ui_design_field`/`attachment_field`'s "unset skips capture, everything else still works" posture, rather than requiring it.
- Stop the parent ticket's `lv start` entirely on a confirmed split (no branch/state/commit) rather than also creating one for the parent — the parent ticket's actual work has moved to its sub-tasks; nothing meaningful would be tracked by a parent-ticket branch.
- Resolve the branch name after loading the ticket, because the ticket title is part of the rendered branch summary.
- Resolve the base branch from the selected branch type once per invocation, so both fresh branch creation and restart recreation fork from the same type-specific base branch.
- Treat a missing ticket Feature ID as recoverable instead of failing the command, and try to reuse existing feature docs before allocating new IDs.
- Allow multiple feature IDs when the change appears to span multiple new features, rather than forcing every start to map to exactly one feature.
- Generate placeholder feature docs for missing feature directories so ticket-driven starts can bootstrap documentation in the same run.
- Pause for confirmation after generating docs, because those files are intended to be reviewed before commit.
- Sync features to the Lark Features table independently of ticket write-back, so existing docs can still be backfilled into Lark.
- Detect whether the ticket Feature ID column is a Link field from Lark metadata, because link fields require resolved record IDs rather than plain text values.
- Perform ticket status update as a separate best-effort write and only when status syncing is enabled.
- Check for existing branches before ticket-source, task-splitting, or feature-matching work so rerunning `lv start` on an in-progress change can resume cheaply, and so the resume/restart mechanism works identically for both entry points (it's shared, ticket-agnostic code).
- Create the branch before writing state and committing so the resulting context is anchored to the intended branch.
- Use a single YAML state file as the source of truth for the change context.
- Stage all changes before commit, which means `lv start` can include unrelated dirty files if they are present in the working tree.
- Keep Lark writes non-fatal so the local LV context can still be created even when ticket sync, attachment download, sub-ticket creation, or feature-table sync fails.
- Use LLM-assisted matching, splitting, and task-complexity analysis only when their preconditions are met (existing feature docs available, ticket lacks an explicit Feature ID, ticket-based start not being resumed), so `lv start` can remain automated without forcing a manual step.
- Preserve optional UI design references and downloaded attachment paths from Lark into persisted state so downstream OpenSpec steps can reuse them.

### Non-Goals (task-splitting)

- No support for splitting a `lv start --description` change — there's no ticket system to sync sub-tasks into for that path.
- No automated parallel execution or "agent team" orchestration — `lv start` only prints guidance that sub-tasks can be started one at a time or in parallel; it never launches or coordinates coding agents itself.
- No inline editing of individual suggested sub-tasks — the engineer accepts the suggested breakdown as a whole or declines it; adjusting a sub-task happens by editing its Lark record afterward.
- No copying of attachments or UI design references onto sub-tickets — those stay on the parent ticket.
