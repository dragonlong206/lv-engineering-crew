## Context

See `proposal.md` - Why/What Changes for motivation and scope. Two facts shape this design:

- OpenSpec change names are not derivable from an LV change ID. `openspec/changes/` in this repo already contains changes named as descriptive kebab-case slugs (e.g. `multi-feature-tasks-lark-sync`) rather than the ticket ID recorded in the corresponding `docs/changes/<ticket-id>/state.yaml`. There is no naming convention `lv status` can rely on to find the right OpenSpec change directory.
- One LV change can spawn more than one OpenSpec change. So the association LV needs to persist is a list, not a single name, and reporting must handle zero, one, or several tracked names.

## Goals / Non-Goals

**Goals:**
- Let `lv status` report, for each OpenSpec change tracked against the current LV change, where it stands and what to do next.
- Record that tracking association explicitly (no guessing/heuristic matching), populated automatically by `/opsx:propose` when it creates a new OpenSpec change.
- Keep `lv status` resilient: a missing `openspec` CLI, an untracked/archived change, or any lookup failure degrades to "could not be determined" for that entry, never a hard failure of the command.

**Non-Goals:**
- Backfilling `openspec_changes` for changes that already have an OpenSpec change created before this feature ships (the field starts empty for them; the engineer can run `lv link <name>` manually once to backfill).
- Any other `/opsx:*` workflow (apply, archive, sync, update) writing to `openspec_changes` — only `/opsx:propose`'s change-creation step does, since that's the only point a brand-new name is minted.
- Parsing `tasks.md` checkboxes directly in LV code (see Decisions - reusing `openspec instructions apply`).

## Decisions

### Persist the association explicitly via `state.yaml` + a new `lv link` command, not auto-detection
Considered matching heuristically (e.g. "if exactly one OpenSpec change exists, assume it's this one"). Rejected: this repo already has multiple in-flight OpenSpec changes at once, so "exactly one" won't hold, and any fuzzier heuristic risks silently attributing status from the wrong change. Explicit recording has one moving part (`lv link`, called once per OpenSpec change creation) and is unambiguous.

`openspec_changes: string[]` (default `[]`) is added to `StateSchema` in `src/types.ts`. Default-empty keeps existing `state.yaml` files on disk valid without migration.

`lv link <openspec-change-name>` (`src/cli/link.ts`) resolves the current change the same way `lv status`/`lv resume` do — `currentBranch()` + `matchBranch()` → change ID — then appends the name to `openspec_changes` via a small helper in `src/engine/state-io.ts` (`readState`, push if absent, `writeState`), matching the existing read-modify-write pattern already used elsewhere for `state.yaml`.

### `lv init` idempotently patches `/opsx:propose` to call `lv link`, rather than a one-off hand edit
`.claude/commands/opsx/propose.md`'s existing step 1 ("LV Crew: before asking, check for a `docs/changes/<change-id>/state.yaml`...") is not a manual, one-time edit — it's installed by `lv init`'s existing `addProposeStateAutoload()` (`src/cli/init.ts`), which patches all three generated copies (`.claude/commands/opsx/propose.md`, `.claude/skills/openspec-propose/SKILL.md`, `.agents/skills/openspec-propose/SKILL.md`) by finding a stable anchor line and inserting a fixed instruction line before it, skipping files that already contain it. This matters because `openspec update`/`openspec init --force` regenerates these files from scratch, silently discarding any hand edit; a patch applied by `lv init` itself is instead re-applied the next time `lv init` runs.

The `lv link` instruction needs the same treatment, so a new `addProposeLinkInstruction()` is added to `src/cli/init.ts` following the exact same shape as `addProposeStateAutoload()`:
- Same `PROPOSE_WORKFLOW_FILES` list and per-file `fs.existsSync` skip.
- Same "already patched" guard: skip a file whose whitespace-normalized content already contains the new instruction line (a new `PROPOSE_LINK_CHANGE_LINE` constant in `src/prompts.ts`, alongside `PROPOSE_STATE_AUTOLOAD_LINE`).
- A different anchor: instead of `PROPOSE_ASK_USER_LINE_RE` (step 1's "ask the user" line), this anchors on step 3's "This creates a scaffolded change in the planning home resolved by the CLI with `` `.openspec.yaml` ``." line — present right after the `openspec new change` code block — and inserts the new instruction immediately *after* that line (not before, since the instruction only makes sense once a change has actually been created), at the same indentation.
- If the anchor line isn't found (the file's shape changed upstream), log and skip that file, same as the existing function does — never throw and abort `lv init` over one file.

`runInit()` calls `addProposeLinkInstruction(repoRoot)` alongside the existing `addContextPointer()`, `addArchiveGuidance()`, and `addProposeStateAutoload()` calls.

### Reuse OpenSpec's own reported state instead of re-deriving it
For each tracked name, `lv status` calls two existing `openspec` CLI JSON endpoints rather than re-implementing OpenSpec's logic:

1. `openspec status --change <name> --json` → `isComplete` (all planning artifacts done/skipped) and, when not complete, `nextSteps` (OpenSpec's own human-readable guidance on what artifact to create next) — used directly as the "still planning" suggestion text.
2. When `isComplete` is true, `openspec instructions apply --change <name> --json` → `progress.remaining` (count of unchecked tasks) distinguishes "continue implementing" (`remaining > 0`, suggest `/opsx:apply`) from "fully implemented" (`remaining === 0`, suggest `/opsx:archive`).

This avoids LV parsing `tasks.md` checkboxes itself or re-encoding OpenSpec's artifact dependency rules — both already exist in the `openspec` CLI and can change independently of LV.

### New `src/integrations/openspec/client.ts` wrapper, mirroring the git client
A thin `execa('openspec', args, { cwd: repoRoot })` wrapper, structured like `src/integrations/git/client.ts`'s `git()` helper: one low-level runner plus small typed functions (`getChangeStatus(repoRoot, name)`, `getApplyProgress(repoRoot, name)`) that JSON-parse stdout. Each catches/rethrows a domain error rather than letting a raw `execa` rejection escape, so `runStatus()` can catch failures per tracked name and continue with the rest.

### Failure handling is per tracked name, not all-or-nothing
Each name in `openspec_changes` is looked up independently; a failure for one (CLI missing, change archived/deleted, malformed JSON) prints "OpenSpec status could not be determined" for that name only and does not prevent reporting the others or printing the base state summary.

## Risks / Trade-offs

- [`openspec_changes` can drift from reality if an OpenSpec change is renamed or its directory removed outside of `lv link`/normal archiving] → Mitigation: lookups fail gracefully per-name (reported as "could not be determined"), and `lv link` is idempotent so re-running it after a rename is cheap; no automatic pruning is implemented since OpenSpec has no rename-notification hook to key off.
- [Existing changes started before this feature ships have no recorded `openspec_changes` even though an OpenSpec change may already exist for them] → Mitigation: documented as a non-goal; `lv link <name>` can be run manually once to backfill.
- [Two more `openspec` CLI calls per tracked name adds latency to `lv status`] → Accepted: `lv status` is an interactive, on-demand command, not run in a hot loop; the calls are local, non-network subprocess invocations.
- [`addProposeLinkInstruction()`'s anchor line ("This creates a scaffolded change...") could change if a future OpenSpec version rewords the generated propose template] → Mitigation: same accepted trade-off the existing `addProposeStateAutoload()` already makes — log and skip that file rather than throwing, so an upstream wording change degrades to "not patched" instead of breaking `lv init`.
