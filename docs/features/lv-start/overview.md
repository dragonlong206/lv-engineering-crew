<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# lv start

`lv start` creates the initial change context for a new LV workflow run. It writes `docs/changes/<change-id>/state.yaml`, creates or reuses a Git branch for that change, stages and commits the resulting context, and prints the state file path with a reminder to continue through the OpenSpec workflow.

The command supports two entry modes:

- Ticket-backed start from a Lark Base record ID.
- Description-backed start from free text via `--description`.

Ticket-backed starts fetch the ticket from Lark Base, run a pre-branch complexity analysis that can offer to split an oversized ticket into linked sub-tickets (see below), use the ticket title in the branch name, persist ticket metadata in state, and can optionally sync newly allocated feature IDs back to the ticket. They can also update the ticket status to the configured in-dev value. Description-backed starts skip Lark, derive a short title from the first line of the description, and use that as the basis for the change ID, branch name, and persisted state.

`src/cli/start.ts` itself is now a thin orchestrator: it composes a `TicketSource` abstraction, a feature-matching module, a task-splitting module, and a branch-resolution module rather than doing ticket I/O, LLM calls, and interactive branch-resume prompting inline. This was a SOLID-focused internal refactor (no change to any of the externally observable behavior described in this paragraph) done specifically to make it possible to plug in a ticket system other than Lark without touching `lv start`'s own control flow — only Lark is actually wired up today.

## Main components

- `src/index.ts` registers `start [ticket-id]` with `--type <type>` and `--description <description>`.
- `src/cli/start.ts` contains `runStart()` and both start flows (`startFromTicket()`/`startFromDescription()`), composing the collaborators below. It no longer talks to Lark or Mastra directly except for one call to `syncFeatureToLarkTable()`.
- `src/integrations/tickets/types.ts` defines the source-agnostic `Ticket` and `TicketSource` interfaces `lv start` depends on for ticket-based starts (Dependency Inversion) — `fetch`, `downloadAttachments`, `updateFeatureId`, `updateStatus`, `createSubtickets`.
- `src/integrations/tickets/lark-ticket-source.ts` is the only `TicketSource` implementation today: `createLarkTicketSource(config)` returns a `LarkTicketSourceHandle` (a `TicketSource` plus one Lark-only `getAccessToken()` escape hatch) that wraps `src/tools/lark.ts`, owning the Lark credential check, the cached tenant-token fetch, and every write-back's (including `createSubtickets()`'s) enabled/disabled branching and console messaging.
- `src/tools/lark.ts` is the raw Lark Bitable API client: fetches tickets, downloads ticket attachments, updates ticket Feature ID values, updates ticket status, creates sub-ticket records (`createSubticket()`), and syncs feature records to a Lark Features table when configured. It has no knowledge of `TicketSource`.
- `src/engine/feature-matching.ts` holds the LLM-assisted feature-match/split agents and `matchExistingFeature()`, `inferFeatureSplit()`, `confirmFeatureMatches()` — "which feature(s) does this change belong to."
- `src/engine/task-splitting.ts` holds the LLM-assisted `taskSplitAgent` and `analyzeTaskComplexity()` — "is this ticket too big/complex for one change, and if so what sub-tasks does it imply."
- `src/engine/branch-resolution.ts` holds `resolveExistingBranch()` — "does a branch already exist for this change, and what should happen about it" (the resume-or-restart flow).
- `src/engine/branch-naming.ts` renders branch names from configured patterns, slugifies summaries, resolves the base branch for a branch type, and matches existing branches back to a change ID.
- `src/engine/feature-id.ts` allocates new feature IDs and enumerates existing feature docs for matching.
- `src/cli/bootstrap.ts` generates feature doc placeholders for missing feature directories during `lv start`.
- `src/engine/state-io.ts` writes and reads `docs/changes/<change-id>/state.yaml`.
- `src/integrations/git/client.ts` creates, checks out, deletes, stages, commits, and pushes Git branches.
- `src/types.ts` defines the persisted state and configuration schemas, including the Lark sync settings and `task_splitting` config.

## High-level flow

1. Load repository configuration and resolve the repo root.
2. Resolve the branch type from `--type` or `default_branch_type`, then determine that type's base branch.
3. Check whether a branch already exists for the target change ID (`resolveExistingBranch()`). If it does, prompt to resume or restart before any Lark or LLM work.
4. For ticket-based starts, construct a `TicketSource` (`createLarkTicketSource()`) and call `source.fetch(ticketId)` — this fetches the ticket (checking Lark credentials and caching a tenant token internally).
5. For ticket-based starts on a fresh (non-resumed) run, analyze the ticket's complexity (`analyzeTaskComplexity()`) unless `task_splitting.enabled` is `false`. If the analysis recommends splitting the ticket, present the reason and suggested sub-tasks and ask the engineer to confirm (`confirmTaskSplit()`). On confirmation, create one linked sub-ticket per suggested sub-task (`source.createSubtickets()`), print guidance to start each individually, and stop — no attachment download, feature matching, or branch/state/commit for the parent ticket. On decline (or when analysis finds no need to split), continue with the flow below unchanged.
6. Download any configured ticket attachments into `docs/changes/<change-id>/attachments/` via `source.downloadAttachments()`.
7. For ticket-based starts, build the branch name from the ticket title. For description-based starts, derive a title from the first line of the description, convert it into a change ID, and render the branch name from that value.
8. Determine the feature IDs to associate with the change (`src/engine/feature-matching.ts`). If a ticket already has feature IDs, use them. If it has none, try to match existing features, otherwise infer one or more new feature titles and allocate new IDs.
9. For any referenced feature whose `docs/features/<id>/` directory is missing, generate placeholder feature docs and prompt for confirmation before continuing.
10. Sync referenced features to the Lark Features table when enabled (`syncFeatureToLarkTable()`, a direct Lark call reusing the `TicketSource`'s cached token via `getAccessToken()`), then write any newly allocated feature IDs back to the ticket via `source.updateFeatureId()` when ticket sync is enabled. These writes are best effort.
11. Update the ticket status via `source.updateStatus()` when status sync is enabled and the current value differs from the configured in-dev value.
12. Create the branch if needed, write `docs/changes/<change-id>/state.yaml`, stage the repository, and commit the change context.
13. Print the context path and the OpenSpec next-step hint.

## Constraints and assumptions

- The command accepts either `lv start <ticket-id>` or `lv start --description "..."`.
- `--type` selects a branch type from `branch_types`, or from the built-in default branch types when `branch_types` is unset.
- The base branch comes from the selected branch type's `base_branch` when configured, otherwise `default_branch`.
- Ticket-backed starts use the ticket ID as the change ID for state storage and commit messages.
- Description-backed starts derive the change ID from the first line of the description and replace hyphens with underscores so the value can stand in for `{ticket_id}` in branch patterns. Task-splitting analysis only runs for ticket-based starts — there is no ticket system to sync sub-tasks into for a description-based start.
- Task-splitting analysis (`task_splitting.enabled`, default `true`) only runs on a fresh ticket-based start with no existing branch to resume; resuming skips it. `task_splitting.threshold_hours` (default `4`) tunes the estimate threshold fed to the model.
- A confirmed split creates one Lark ticket-table record per suggested sub-task; `lark.subtask_parent_field`, when set, is written on each as a link back to the parent ticket. Left unset, sub-tickets are still created, just without that relationship recorded. Sub-task creation is best-effort per sub-task — one failure doesn't block the others.
- A confirmed split stops the parent ticket's `lv start` run entirely: no attachment download, feature matching, branch, `state.yaml`, or commit happens for the parent. `lv start` does not launch or orchestrate any coding agents for the created sub-tasks — it only prints guidance to run `lv start <sub-ticket-id>` for each, one at a time or in parallel, at the engineer's discretion.
- A ticket with no Feature ID can still start a change. The command first tries to reuse existing feature docs, then infers and allocates new feature IDs if needed.
- Missing feature docs are generated only for feature directories that do not already exist, and the command pauses for confirmation before continuing.
- `commitAll()` stages every dirty path in the repository, so unrelated local changes can be included in the `lv start` commit.
- Lark access tokens are fetched per invocation (cached for that invocation's lifetime inside the `TicketSource` instance) and are not cached across runs.
- Newly allocated feature IDs are only written back to Lark when `lark.sync_feature_id` is enabled.
- Ticket status sync is best effort and only runs when `lark.sync_status` is enabled.
- Existing feature docs are still synced to the Lark Features table when feature-table sync is configured, independent of which `TicketSource` is in play.
- If a matching branch already exists, `lv start` can resume on it instead of creating a new branch.
- Ticket starts can capture UI design references and downloaded attachments in state when the relevant Lark columns are configured.
- Only Lark is wired up as a `TicketSource` today; adding a second ticket system means implementing the interface (including `createSubtickets()`) and swapping (or switching on) the one construction call in `startFromTicket()` — no config-driven source selection exists yet.

## Current state of the code

`lv start` is implemented in `src/cli/start.ts` and registered in `src/index.ts`. The current implementation supports both ticket-backed and free-text starts, existing-branch resume or restart, a pre-branch complexity analysis for ticket-based starts that can offer to split an oversized ticket into linked sub-tickets, attachment download for ticket runs, placeholder feature doc generation for missing feature directories, best-effort sync of new feature IDs back to Lark, ticket status updates when configured, and syncing referenced features into the Lark Features table when configured. The persisted state schema currently includes `ticket_id` only for ticket-based starts, plus `title`, `description`, `feature_ids`, `branch`, `created_at`, `lv_version`, `openspec_changes`, optional `ui_design`, and optional `attachments`. Ticket I/O lives behind a `TicketSource` interface (`src/integrations/tickets/`), and feature-matching/task-splitting/branch-resolution live in their own `src/engine/` modules — verified live against the real configured Lark Base (split-confirm, decline, no-split-needed, disabled-config, and no-relationship-field scenarios all exercised end-to-end in an isolated scratch clone, then cleaned up).
