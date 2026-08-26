## 1. Remove the legacy analysis/design pipeline

- [x] 1.1 Delete `src/cli/answer.ts`, `src/cli/approve.ts`, `src/cli/design.ts`, and `src/engine/state-machine.ts`; remove their `program.command(...)` registrations from `src/index.ts` and verify `npx tsc --noEmit` reports no dangling imports.
- [x] 1.2 Delete `src/agents/analysis-agent.ts` and `src/agents/design-agent.ts`; remove `ANALYSIS_AGENT_INSTRUCTIONS`, `buildAnalysisPrompt`, `DESIGN_AGENT_INSTRUCTIONS`, `buildDesignPrompt` (and any helper used only by them) from `src/prompts.ts`, and verify `npx tsc --noEmit` passes with no unused-export references left in `src/cli/start.ts`.

## 2. Shrink `state.yaml`'s schema

- [x] 2.1 In `src/types.ts`, remove `StepStatusSchema`, `StepRecordSchema`, `STEPS`, `Step`, and `current_step`/`steps` from `StateSchema`; add `description`, `title`, and make `ticket_id` optional per design.md's decision 4 shape. Verify `npx tsc --noEmit` passes and every remaining `state.*` field access in the codebase compiles against the new `State` type.
- [x] 2.2 Update `src/engine/state-io.ts`'s `writeState`/`readState` (or equivalent) call sites for the new shape and verify `lv status`/`lv resume` (see section 5) round-trip a hand-written `state.yaml` in the new shape without a zod validation error.

## 3. Rework `lv init` as the OpenSpec installer

- [x] 3.1 Rewrite `src/cli/init.ts`: drop the raw-document-splitting body (`initAgent`, `buildInitPrompt` call, `allocateFeatureIds()` call, `docPaths` handling, `updateIndex()` call); add an `openspec init --tools <tool>` invocation via `execa` (matching the pattern in `src/integrations/git/client.ts`), accepting an optional `--tool <tool>` CLI option and passing through to OpenSpec's own interactive prompt when omitted. Verify `lv init --tool claude` (run against a scratch repo) produces the same `.claude/skills/openspec-*`/`.claude/commands/opsx/*` output as running `openspec init --tools claude` directly.
- [x] 3.2 Remove the `<docs...>` positional argument and `--id-prefix`/`--id-digits` options from `lv init`'s `program.command(...)` definition in `src/index.ts`; remove `buildInitPrompt`/`AUTO_GENERATED_HEADER`'s `init`-specific usage from `src/prompts.ts` (keep `AUTO_GENERATED_HEADER` itself — `bootstrap.ts` still uses it). Verify `lv init --help` no longer mentions requirement documents or feature-ID options.
- [x] 3.3 Implement the `openspec/config.yaml` `context:` pointer write from design.md's decision 1: on `lv init`, check whether the pointer text is already present in `context:` and append it idempotently if not (naming the `docs/features/<id>/` path and the `docs/changes/<change-id>/state.yaml` path). Verify running `lv init` twice leaves `openspec/config.yaml`'s `context:` field with exactly one copy of the pointer text.
- [x] 3.4 Verify end-to-end: after `lv init --tool claude` and starting a change (section 4), running `openspec instructions proposal --change <name> --json` returns a `context` field that includes the pointer text.

## 4. Rework `lv start` with two entry modes

- [x] 4.1 In `src/cli/start.ts`, remove the `analysisAgent`/`buildAnalysisPrompt` call, the `1.proposal.md` write, and the `current_step`/`steps.analysis` fields from the `writeState()` call; keep ticket fetch, feature-ID allocation/inline-bootstrap (`lv-start/inline-feature-bootstrap`), branch creation, and Lark feature-ID sync untouched. Verify `lv start <ticket-id>` (against a test Lark ticket or a mocked fetch) creates `docs/changes/<ticket-id>/state.yaml` with `ticket_id`/`title`/`description`/`feature_ids`/`branch`/`created_at`/`lv_version` and writes no `1.proposal.md`.
- [x] 4.2 Add a free-text description entry mode (`lv start --description "<text>"` or equivalent per `src/index.ts` command signature) that skips the Lark fetch entirely, derives a `change-id` slug from the description/title, creates `docs/changes/<change-id>/`, and writes the same `state.yaml` shape with `description` set and `ticket_id` omitted. Verify `lv start --description "..."` (no ticket ID given) makes no network call to Lark and produces a valid `state.yaml`.
- [x] 4.3 Verify both entry modes still create and check out a branch per `renderBranchName()` (`src/engine/branch-naming.ts`), and still run `commitAll()` at the end — confirm via `git log`/`git status` after each mode's run in a scratch repo.
- [x] 4.4 Update the end-of-run console output in `src/cli/start.ts` (previously "Review the document and answer the questions, then run `lv answer`") to point the engineer at their coding agent's OpenSpec workflow (e.g. `/opsx:propose`) instead.

## 5. Simplify `lv resume` and `lv status`

- [x] 5.1 In `src/cli/resume.ts`, remove the `StateMachine`/`runApprove`/`runDesign` dispatch (the second half of `runResume()`); keep the branch-resolution logic (ticket-ID lookup across configured branch types, current-branch matching, `promptSelect()` fallback) unchanged. After resolving and checking out, print the change's `state.yaml` summary and a pointer to run the coding agent's OpenSpec workflow. Verify `lv resume <ticket-id>` against a change created in section 4 checks out the right branch and prints its state summary without invoking any removed command.
- [x] 5.2 In `src/cli/status.ts`, remove `printStep()` and the `current_step`/`steps` field reads; print `ticket_id` (or "description-only"), `title`, `description`, `feature_ids`, `branch`, `created_at` instead. Verify `lv status` on a change from section 4 prints the new fields with no error.

## 6. Update project docs and config

- [x] 6.1 Update `README.md` and `CLAUDE.md`'s two-pipeline architecture description, command wiring table, and any gotchas referencing `lv answer`/`lv approve`/`lv design`/`current_step`/`StateMachine` to match the new flow (init installs OpenSpec, start writes context, engineer drives OpenSpec, `openspec apply` implements). Verify by grep: no remaining reference to `lv answer`, `lv approve`, `lv design`, or `StateMachine` in `README.md`/`CLAUDE.md`.
- [x] 6.2 Add `.lv.yaml`/`ConfigSchema` documentation (in `README.md` or inline comments) for any new `lv init` configuration (e.g. a default `--tool`), and verify `npx tsc --noEmit` still passes after any `ConfigSchema` additions in `src/types.ts`.

## 7. Final verification

- [x] 7.1 Run `npx tsc --noEmit` and `npm run build` and verify both succeed with the legacy pipeline fully removed.
- [x] 7.2 Run a full manual walkthrough against a scratch target repo: `lv init --tool claude` → `lv start <ticket-id>` → `/opsx:propose` (or the installed agent's equivalent) reads the change's context automatically → `lv start --description "..."` for a second, ticket-less change → `lv status`/`lv resume` on each. Verify each step's observable output matches the scenarios in `specs/lv-init/openspec-bootstrap/spec.md` and `specs/lv-start/change-context-init/spec.md`.
