## Why

`lv status` only echoes the persisted `state.yaml` metadata (title, description, feature IDs, branch, timestamps). It says nothing about where the change actually stands in the OpenSpec workflow — whether a change proposal exists yet, which planning artifact is next, whether implementation is in progress, or whether the change is fully implemented and ready to archive. Engineers currently have to separately run `openspec status --change <name>` (and know the mapping from the current branch to the OpenSpec change name) to find that out. `lv status` already bridges branch → change context for the LV pipeline; it should do the same for the OpenSpec pipeline it hands off to.

## What Changes

- `state.yaml` gains a new optional field, `openspec_changes: string[]` (defaulting to `[]`), recording the name(s) of the OpenSpec change(s) created for this LV change. One ticket-based LV change can spawn more than one OpenSpec change (e.g. split across areas), so this is a list, not a single name — there is no way to derive OpenSpec change names from the LV change ID by convention (in practice, `/opsx:propose` names OpenSpec changes with a descriptive kebab-case slug, not the LV change/ticket ID), so LV must record the association explicitly instead of guessing it.
- New CLI command `lv link <openspec-change-name>`: resolves the current change from the current branch (same resolution `lv status`/`lv resume` use) and appends the given name to that change's `state.yaml` `openspec_changes` list, if not already present (idempotent).
- `lv init` gains a third idempotent patch step, alongside its existing `addContextPointer()` and `addArchiveGuidance()` (`openspec/config.yaml`) and `addProposeStateAutoload()` (the generated `/opsx:propose` files): it inserts an LV Crew instruction into `.claude/commands/opsx/propose.md` and its mirrored skill files telling the workflow to run `lv link "<name>"` immediately after `openspec new change "<name>"` succeeds, skipped when there is no `state.yaml` matching the current branch. Re-running `lv init` re-applies this (and the existing autoload patch) if `openspec update`/`openspec init --force` has regenerated those files since.
- `lv status` additionally reads `openspec_changes` from the current change's `state.yaml` and, for each recorded name, reads its OpenSpec artifact status via the `openspec` CLI (`openspec status --change <name> --json`).
- After the existing state summary, `lv status` prints a "Next action" section per tracked OpenSpec change, suggesting what to do next:
  - `openspec_changes` is empty → suggest running `/opsx:propose` to start planning.
  - A tracked change exists but planning artifacts are incomplete → surface OpenSpec's own next-step guidance (which artifact to create next).
  - Planning is complete but `tasks.md` has unchecked tasks → suggest `/opsx:apply` to continue implementation.
  - All tasks are checked off → suggest `/opsx:archive`.
- If the `openspec` CLI is unavailable or a lookup for a tracked name fails (e.g. the directory was removed or archived), `lv status` degrades gracefully for that entry: it still prints the existing state summary and reports that OpenSpec status could not be determined for that name, rather than exiting with an error.
- `lv resume` is unaffected — it continues to call the same `printStateSummary()` it does today; the new OpenSpec lookup and reporting is added only to `lv status`'s own code path.

## Capabilities

### New Capabilities
- `lv-status/openspec-next-action`: `lv status` reads the OpenSpec artifact status of the current change's tracked OpenSpec change(s) and prints a suggested next workflow action for each.
- `lv-link/record-openspec-change`: a new `lv link <openspec-change-name>` command records an OpenSpec change name against the current branch's `state.yaml`, and `/opsx:propose` calls it automatically after creating a new OpenSpec change.

### Modified Capabilities

(none — the existing branch-resolution and state-summary behavior of `lv status` is unchanged; this only adds a new section to its output)

## Impact

- `src/types.ts`: `StateSchema` gains `openspec_changes: string[]` (default `[]`), so existing `state.yaml` files without the field remain valid.
- `src/engine/state-io.ts`: gains a helper to append a name to `openspec_changes` idempotently and persist it via the existing `writeState()`.
- New `src/cli/link.ts` (`runLink(openspecChangeName)`) and a `lv link <openspec-change-name>` command registered in `src/index.ts`, following the existing per-command lazy-import shape.
- `src/cli/status.ts`: `runStatus()` gains a step that looks up and prints OpenSpec status/next-action for each name in `openspec_changes`, after the existing state summary.
- New integration code (e.g. `src/integrations/openspec/client.ts`, mirroring the `execa` wrapper pattern in `src/integrations/git/client.ts`) to shell out to `openspec status --change <name> --json` and parse its result. This is the first place LV code invokes the `openspec` CLI or reads anything under `openspec/` — previously LV's job stopped at handing context to OpenSpec (see `CLAUDE.md`'s "OpenSpec integration" section).
- `src/prompts.ts`: new `PROPOSE_LINK_CHANGE_LINE` constant (the LV Crew instruction text), alongside the existing `PROPOSE_STATE_AUTOLOAD_LINE`.
- `src/cli/init.ts`: new `addProposeLinkInstruction()`, following the exact idempotent-patch shape of the existing `addProposeStateAutoload()` — same `PROPOSE_WORKFLOW_FILES` list (`.claude/commands/opsx/propose.md`, `.claude/skills/openspec-propose/SKILL.md`, `.agents/skills/openspec-propose/SKILL.md`), same "already patched" text-presence check, but anchored on the "This creates a scaffolded change..." line (step 3) instead of the "ask the user" line (step 1) — called from `runInit()` alongside the other two patch calls.
- Adds a soft runtime dependency: the target repo must have the `openspec` CLI available on `PATH` for the new `lv status` section to resolve (already a prerequisite of `lv init`); when it's missing or a given lookup errors, `lv status` still succeeds and just reports that entry as undetermined.
