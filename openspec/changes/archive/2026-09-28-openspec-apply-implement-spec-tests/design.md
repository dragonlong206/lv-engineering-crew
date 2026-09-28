## Context

`lv init` (`src/cli/init.ts`) already post-processes `openspec/config.yaml` in two ways. `addContextPointer()` writes `context:`, and `addArchiveGuidance()` writes `operations.archive.guidance`. Both are raw-text appends when their top-level key is still only commented out in OpenSpec's template, and both fall back to a `js-yaml` load+dump merge (which drops the template's comments) once the key is active.

The installed OpenSpec is 1.12.0, and it has two hooks for this change:

- **`operations.<id>.guidance`**: `OPERATION_IDS = ['apply', 'archive']` in `@fission-ai/openspec/dist/core/project-config.js`. `openspec instructions apply --change <name> --json` returns the entries as `operationGuidance`. The generated `/opsx:apply` command and the `openspec-apply-change` skill (`.claude/commands/opsx/apply.md`, `.claude/skills/openspec-apply-change/SKILL.md`, step 4) already read that field and treat it as "optional additive advice".
- **`rules.<artifact-id>`**: a `Record<string, string[]>` that `openspec instructions <artifact> --json` returns as `rules` for that artifact only. The propose workflow applies it as constraints when drafting that artifact.

For motivation, see proposal.md - Why. For required behavior, see `specs/lv-init/spec-test-guidance/spec.md`.

## Goals / Non-Goals

**Goals:**
- Use only OpenSpec's supported config hooks, so the guidance survives `openspec update` / `openspec init --force`.
- Share one write path for the archive and apply operation guidance, so neither write can undo or duplicate the other.
- Keep the template's comments on a fresh `lv init`, with no key active yet.

**Non-Goals:**
- Detecting the target repo's test framework in `lv`. The agent does this itself at apply time; `lv` names no framework.
- Enforcing that tests were written or pass. The spec requires the guidance to be advisory.
- Adding a test suite to this repo.
- Adding a legacy-wording upgrade path for the new text. There is no prior wording yet, but the constants go through the same helper that already supports one (see Decision 3).

## Decisions

### 1. Use `operations.apply.guidance`, not a patch to the generated apply files or a `context:` line

The `/opsx:propose` patches (`addProposeStateAutoload()` and the others) had to edit generated files because they act before any `openspec instructions` call. Apply has no such problem: it reads `operationGuidance` in step 4, before it implements anything.

- *Alternative: anchor-regex patch into `apply.md` / `SKILL.md`.* Rejected. The patch is wiped by `openspec update`, it has to track three file shapes, and it breaks silently if upstream wording changes.
- *Alternative: another `CONTEXT_POINTER_LINES` entry.* Rejected. `context:` goes to every workflow (explore, propose, archive), so this would put apply-only instructions in all of them. The same scoping reasoning led to `PROPOSE_UI_DESIGN_LINE` being kept out of `context:`.

### 2. Also add `rules.tasks`, not only apply guidance

Apply works task by task from `tasks.md` and ticks off checkboxes. On its own, advisory guidance at apply time loses out to a concrete checklist that contains no test tasks. A `rules.tasks` entry makes `/opsx:propose` write test tasks, each naming the scenarios it covers, into `tasks.md`, so tests become checklist items that apply ticks off like any other task. The apply guidance stays as a backstop for changes whose `tasks.md` predates the rule or was written by hand.

- *Alternative: rules on `specs` too.* Rejected. The specs instruction already says "each scenario is a potential test case". What was missing is turning scenarios into tasks and tests, not making the scenarios testable.

### 3. Generalize `addArchiveGuidance()` into one operation-guidance writer

Replace it with `addOperationGuidance(repoRoot, entries)`, where each entry is `{ operation, text, legacy? }`. The function handles every LV-owned operation entry in one pass:

- If no `operations:` key is active, it appends a single raw-text block containing *all* entries (`operations:\n  archive:\n    guidance:\n      - "…"\n  apply:\n    guidance:\n      - "…"`), with each value `JSON.stringify`-quoted for the same `": "` reason already documented in `addArchiveGuidance()`.
- Otherwise it loads the YAML, and for each entry either upgrades its `legacy` match in place, appends the entry if it is missing, or leaves it alone. Then it dumps the file once.

The reason for one pass: if `runInit()` called one writer per operation in sequence, the archive call would append a fresh `operations:` block, and the apply call would then see an active key and take the YAML round-trip branch. That branch strips the template comments on every fresh install, which is the outcome the append branch exists to prevent. `ARCHIVE_GUIDANCE`/`LEGACY_ARCHIVE_GUIDANCE` move over unchanged as the archive entry, so archive behavior is identical.

- *Alternative: keep `addArchiveGuidance()` and add a sibling `addApplyGuidance()`.* Rejected because of the ordering problem above, and because it would duplicate the load/merge code.

### 4. `rules.tasks` gets its own writer with the same append-or-merge shape

`addArtifactRules(repoRoot, entries)` works like Decision 3, keyed by artifact ID instead of operation. It appends `rules:\n  tasks:\n    - "…"` when `rules:` is not active, and otherwise merges into the existing `rules.tasks` array, keeping any rules the engineer wrote. `rules:` is a separate top-level key from `operations:`, so the two writers cannot collide.

### 5. Guidance wording defers to the repo, and covers a repo with no tests

Both constants go in `src/prompts.ts` (per the prompts-centralization convention), as `APPLY_TEST_GUIDANCE` and `TASKS_TEST_RULE`. They name no framework. They tell the agent to:

- find and follow the existing test framework, locations, and naming;
- cover each `#### Scenario:` in the change's delta specs, and run the tests before checking off the related task;
- when the repo has no automated test framework: in tasks, plan manual or scripted verification per scenario; in apply, not bring in a framework unless a task says to, and report the scenarios left without automated coverage.

The no-framework branch is what makes this safe to run on this repo, which has no test suite (see CLAUDE.md).

## Risks / Trade-offs

- [The agent ignores advisory guidance] → `rules.tasks` (Decision 2) turns tests into checklist items, which is the part apply reliably follows.
- [A target repo uses a custom schema with no `tasks` artifact] → OpenSpec only warns about rule IDs that match no schema artifact. The rule is inert there, and apply guidance still works.
- [The merge branch drops the config's comments] → Same trade-off `addContextPointer()`/`addArchiveGuidance()` already make, and it only happens when the key is already active. Decision 3 avoids triggering it ourselves on a fresh install.
- [Changing `addArchiveGuidance()` regresses archive guidance] → Verify on a fresh scratch repo, on a repo holding `LEGACY_ARCHIVE_GUIDANCE`, and on this repo's current config, checking the result with `openspec instructions archive --json`.
- [Future wording changes] → The `legacy?` field (Decision 3) already supports in-place upgrades. A `rules` legacy field can be added the same way when needed.

## Migration Plan

Engineers re-run `lv init` in an existing repo. That adds `operations.apply` and `rules.tasks` and leaves existing entries alone. Changes that already have a `tasks.md` are unaffected by the rule, and apply guidance covers them. Rollback: delete the two keys from `openspec/config.yaml`.
