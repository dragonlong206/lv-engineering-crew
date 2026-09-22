## Why

The `/opsx:apply` workflow mechanically walks a change's `tasks.md` and implements each task — it doesn't need the same reasoning depth as `/opsx:propose` or `/opsx:explore`. Running it on a high-end model burns budget for no quality gain. An engineer should be able to pin apply to a cheaper model once, in `.lv.yaml`, and have `lv init` wire that pin into the generated Claude Code apply command so every future `/opsx:apply` run actually executes on it.

## What Changes

- Add an optional `openspec.apply_model` setting to `.lv.yaml` (validated by `ConfigSchema`) holding a Claude Code model alias/id (e.g. `"haiku"`), distinct in format and purpose from the existing `models:` map (which holds Mastra `"provider/model"` strings for LV's own throwaway agents and is unrelated to this).
- `lv init` idempotently patches the generated `.claude/commands/opsx/apply.md` frontmatter to add or update a `model: <value>` field from `openspec.apply_model`, whenever that setting is present — this is the only known generated-command shape that supports pinning a slash command's executing model via frontmatter, so no other tool's generated files are touched.
- When `openspec.apply_model` is unset, `lv init` leaves the frontmatter as OpenSpec generated it (no `model:` key) and removes a previously-added one if the setting was cleared since the last `lv init` run, so the file never carries a stale pin.
- Because `openspec update`/`openspec init --force` regenerates `.claude/commands/opsx/apply.md` from scratch and wipes this patch (same caveat as the existing `/opsx:propose` patches), re-running `lv init` re-applies it.

## Capabilities

### New Capabilities
- `lv-init/apply-model-override`: `lv init` reads `.lv.yaml`'s `openspec.apply_model` and idempotently sets, updates, or clears a `model:` frontmatter field on the generated Claude Code `/opsx:apply` command file.

### Modified Capabilities
(none — this introduces a new, independent setting and patch step; it doesn't change the behavior of any existing capability)

## Impact

- `src/types.ts`: new `OpenSpecConfigSchema` (`apply_model` optional string) and an `openspec` field on `ConfigSchema`.
- `src/cli/init.ts`: new idempotent patch function (mirroring the existing `addPropose*Instruction()` functions' anchor-and-patch style) that edits `.claude/commands/opsx/apply.md`'s frontmatter, called from `runInit()`'s existing patch step.
- `src/prompts.ts`: any new static text/markers the patch needs (per this repo's convention that instructional/constant text lives there, not inline in `init.ts`).
- `docs/features/lv-init/{overview.md,design.md}`: refreshed to describe the new patch step (via the `lv-bootstrap` skill/command, per this repo's own archive guidance).
- No change to `lv bootstrap`, `lv start`, or any Mastra agent — the existing `models:` config and `getModelForStep()` are untouched.
