## Why

`lv bootstrap <feature-id>` used to regenerate a feature's docs directly. `lv init`'s archive guidance (`ARCHIVE_GUIDANCE` in `src/prompts.ts`) and its `/opsx:sync` context-pointer convention (`CONTEXT_POINTER_LINES`) both still tell the archiving/syncing agent to refresh a feature's docs "by running `lv bootstrap <feature-id>`". Since `lv bootstrap` was converted to a coding-agent skill/command (PR #16, `e70bcdb`), that same bare invocation now prints an error and exits non-zero instead of generating anything — so following this repo's own installed guidance verbatim during an OpenSpec archive no longer refreshes feature docs at all, silently defeating the point of `lv-init/feature-doc-freshness`. This repo's own `openspec/config.yaml` (and any other repo that ran `lv init` before the skill conversion) already has the stale wording baked in.

## What Changes

- Update `ARCHIVE_GUIDANCE` (`src/prompts.ts`) to instruct invoking the `lv-bootstrap` skill/command for each touched feature ID, instead of running `lv bootstrap <feature-id>` as a bare shell command.
- Update the `/opsx:sync` convention line in `CONTEXT_POINTER_LINES` (`src/prompts.ts`) the same way.
- Add a legacy-text-replace path to `addArchiveGuidance()` and `addContextPointer()` (`src/cli/init.ts`), mirroring the existing `LEGACY_PROPOSE_STATE_AUTOLOAD_LINE`/`addProposeStateAutoload()` pattern: if a project's `openspec/config.yaml` already contains the old, stale wording, replace it in place on the next `lv init` run instead of leaving it untouched or appending a second, duplicate guidance entry alongside it.
- Re-run `lv init` in this repo (dogfooding) so its own `openspec/config.yaml` picks up the corrected wording.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `lv-init/feature-doc-freshness`: the archive-time guidance and the manual-sync convention must reference an invocation of `lv bootstrap <feature-id>` that actually works under the current skill-based CLI (not the pre-skill-conversion bare call, which now errors); re-running the configuring step on a project already carrying the old wording must upgrade it in place rather than leave it stale or duplicate it.

## Impact

- `src/prompts.ts`: `ARCHIVE_GUIDANCE`, `CONTEXT_POINTER_LINES` text; new `LEGACY_ARCHIVE_GUIDANCE`/`LEGACY_CONTEXT_POINTER_SYNC_LINE`-style constant(s) holding the outdated wording for the replace path to match against.
- `src/cli/init.ts`: `addArchiveGuidance()`, `addContextPointer()` gain a legacy-replace branch before their existing "already wired" / fresh-template-append logic.
- `openspec/config.yaml` (this repo, and any other repo that ran `lv init` before the skill conversion): re-running `lv init` corrects the previously-installed stale guidance.
- No change to `lv bootstrap`'s CLI behavior itself, or to the `lv-bootstrap` skill/command contract (`lv-bootstrap/skill-based-generation`) — this fixes only the text that tells an agent how to invoke it.
