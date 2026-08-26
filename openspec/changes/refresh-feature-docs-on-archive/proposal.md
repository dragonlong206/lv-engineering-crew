## Why

`lv bootstrap`-generated feature docs (`docs/features/<id>/{overview.md,design.md,requirements.md}`) have no trigger that keeps them current: regenerating them is a manual, opt-in step, and this repo's own `docs/features/lv-init/`, `lv-answer/`, `lv-approve/`, `lv-design/` already describe code deleted by the in-flight `integrate-openspec-workflow` change — proof the drift is real, not hypothetical. That change also wires OpenSpec's `context:` field to point every workflow step at these docs automatically, which means a stale doc will actively mislead `openspec propose`/`apply` once that pointer is live, rather than just sitting unused. Closing this now — while `context:` wiring is still new — keeps `lv bootstrap`'s output trustworthy enough to be worth pointing OpenSpec at.

## What Changes

- `lv init` additionally writes an idempotent `operations.archive.guidance` entry into `openspec/config.yaml` (same append-only mechanism as the existing `context:` pointer in `addContextPointer()`), instructing the archiving agent to run `lv bootstrap <feature-id>` for each ID in the change's `docs/changes/<change-id>/state.yaml` before completing the archive. This uses `openspec instructions archive --change <name> --json`'s existing `operationGuidance` field, which the generated `/opsx:archive` workflow already reads and follows — no OpenSpec-side change needed.
- `lv init`'s `context:` pointer text gains one line documenting that an engineer running `/opsx:sync` directly (syncing delta specs to main specs without archiving) should also refresh affected feature docs. This is **advisory only**: `openspec instructions` has no `sync` operation in the installed OpenSpec CLI (1.10.0) — no `operations.sync.guidance` hook exists, and the generated `openspec-sync-specs` skill never reads the `context:` field at all. Nothing enforces this convention; it is a documented expectation, not a wired trigger.
- Both instructional-text constants — the new `ARCHIVE_GUIDANCE` and the existing `CONTEXT_POINTER` (currently defined in `src/cli/init.ts`, an exception to the project's "prompts live in `src/prompts.ts`" convention) — move to/land in `src/prompts.ts`. `init.ts` keeps only the file-IO/orchestration functions (`addContextPointer()`, `addArchiveGuidance()`) that import and write them.
- `lv bootstrap` itself is unchanged — its existing "refine an existing draft rather than overwrite" behavior (`generateFeatureDocsFromScan`) is exactly what archive-time re-invocation needs.

## Capabilities

### New Capabilities
- `lv-init/feature-doc-freshness`: `lv init` writes archive-time guidance (wired, via `operations.archive.guidance`) and sync-time guidance (advisory, via the `context:` pointer text) that both point at re-running `lv bootstrap <feature-id>` to keep `docs/features/` in sync with the code a change actually shipped.

### Modified Capabilities
- None. `lv-init/openspec-bootstrap` (the capability that introduces `addContextPointer()` and the `context:` pointer) has no corresponding file yet under `openspec/specs/` — it exists only as a delta spec inside the not-yet-archived `integrate-openspec-workflow` change. This change extends that same code path but cannot declare it "modified" until that capability lands in main specs; treating the freshness behavior as a new capability avoids referencing a main spec path that doesn't exist yet.

## Impact

- `src/prompts.ts`: gains `ARCHIVE_GUIDANCE`; gains `CONTEXT_POINTER` relocated from `src/cli/init.ts` (with its sync-convention line added).
- `src/cli/init.ts`: loses the `CONTEXT_POINTER` constant (now imported from `src/prompts.ts`); gains `addArchiveGuidance()` (a sibling function to `addContextPointer()`, same idempotent check-then-append pattern) and the call to it from `runInit()`.
- `openspec/config.yaml` (this repo's own, and every target repo's after `lv init`): gains an `operations: archive: guidance:` block alongside the existing `context:` key.
- No changes to `lv bootstrap`, `generateFeatureDocsFromScan()`, or any OpenSpec-installed file (`.claude/skills/openspec-*`, `.claude/commands/opsx/*`) — the archive hook is consumed exactly as already generated.
- **Depends on** `integrate-openspec-workflow` landing first: `addContextPointer()` and the `context:` pointer it's extending are introduced by that change, currently uncommitted in this repo's working tree.
