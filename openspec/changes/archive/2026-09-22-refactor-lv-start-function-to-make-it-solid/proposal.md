## Why

`src/cli/start.ts`'s two entry points (`startFromTicket`, `startFromDescription`) each cram
branch resolution, Lark ticket fetching, feature matching/allocation, Lark write-backs, state
assembly, and git operations into one long function. `startFromTicket` alone is ~260 lines and
directly calls `src/tools/lark.ts` functions throughout, so Lark is baked into the control flow
rather than sitting behind a seam — exactly what the ticket flags as the blocker to supporting
any ticket system other than Lark. This change restructures `lv start`'s internals along SOLID
lines so the ticket-fetching concern is isolated behind an interface and the surrounding logic
(branch resolution, feature matching, state assembly) is each in its own single-purpose module.

## What Changes

- Introduce a `TicketSource` interface (`src/integrations/tickets/types.ts`) that normalizes
  "fetch a ticket", "download its attachments", "write a feature ID back", and "write a status
  back" behind source-agnostic methods — `startFromTicket` depends on this interface instead of
  calling `src/tools/lark.ts` directly (Dependency Inversion). `src/tools/lark.ts`'s raw API
  functions are unchanged; a new `LarkTicketSource` adapter (`src/integrations/tickets/lark-ticket-source.ts`)
  wraps them, including the Lark-specific credential check, token handling, and all
  Lark-specific console messaging (fetch/sync-enabled/sync-disabled notices) that currently
  lives inline in `start.ts`.
- Extract feature-matching (`matchExistingFeature`, `inferFeatureSplit`, `confirmFeatureMatches`,
  `summarize`, and the two throwaway Mastra agents that back them) into
  `src/engine/feature-matching.ts` — a single-responsibility module for "which feature(s) does
  this change belong to", reusable and testable independent of `lv start`'s orchestration.
- Extract `resolveExistingBranch` (the resume-or-restart-existing-branch flow) into
  `src/engine/branch-resolution.ts`, unchanged in behavior — a single-responsibility module for
  "does a branch already exist for this change, and what should happen about it".
- `src/cli/start.ts` becomes a thin orchestrator: `runStart`/`startFromTicket`/
  `startFromDescription` compose the extracted collaborators in sequence and keep only the
  logic genuinely specific to gluing them together for `lv start` (placeholder-doc generation +
  confirm prompt, state assembly, commit). No Lark specifics or Mastra `Agent` construction
  remain in this file.
- **No externally observable behavior changes**: CLI flags, prompts, console output, `state.yaml`
  schema, `.lv.yaml` config schema, and the sequence of Lark API calls all stay exactly as they
  are today. This is a pure internal restructuring — see `skip_specs: true` below.

**Non-goals** (explicitly out of scope, to avoid speculative generality): actually implementing
a second `TicketSource` (e.g. Jira, GitHub Issues), and adding a `.lv.yaml` key to select
between ticket sources. Only Lark is wired up after this change — the goal is that adding a
second source later means writing one new file that implements `TicketSource` and swapping (or
switching on) one construction call, not touching `startFromTicket`'s control flow. `src/tools/lark.ts`'s
`syncFeatureToLarkTable()` (feature docs → Lark Features table sync, used by both `lv start` and
`lv bootstrap`) also stays out of `TicketSource` — it syncs feature docs, not ticket state, and
is orthogonal to which system tracks the ticket itself.

## Capabilities

### New Capabilities

None — this is an internal refactor with no new or changed spec-level behavior.

### Modified Capabilities

None. `skip_specs: true` is set in this change's `.openspec.yaml` per the spec-driven schema's
rule for pure refactors: specs describe behavior, and no observable behavior changes here.

## Impact

- **Code**: `src/cli/start.ts` (rewritten, much shorter); new `src/integrations/tickets/types.ts`,
  `src/integrations/tickets/lark-ticket-source.ts`; new `src/engine/feature-matching.ts`,
  `src/engine/branch-resolution.ts`. `src/tools/lark.ts`, `src/engine/branch-naming.ts`,
  `src/engine/feature-id.ts`, `src/engine/state-io.ts`, `src/cli/bootstrap.ts`,
  `src/cli/helpers.ts`, `src/prompts.ts`, and `src/types.ts`/`src/config.ts` are unchanged.
- **Dependents**: `src/cli/bootstrap.ts` still calls `syncFeatureToLarkTable()` directly from
  `src/tools/lark.ts` (untouched by this change). `src/cli/resume.ts`/`status.ts` are unaffected.
- **Tests/verification**: no automated test suite exists (`CLAUDE.md`); verification is
  `npx tsc --noEmit`, `npm run build`, and manually re-running `lv start` (both a ticket ID and
  `--description`) against a scratch repo to confirm identical prompts/output/`state.yaml`.
