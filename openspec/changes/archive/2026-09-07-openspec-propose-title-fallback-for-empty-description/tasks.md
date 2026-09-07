## 1. Update the LV-owned propose autoload source

- [x] 1.1 Update `src/prompts.ts` so `PROPOSE_STATE_AUTOLOAD_LINE` explicitly says `/opsx:propose` uses `state.yaml.description` when present and falls back to `state.yaml.title` when `description` is empty, and verify the new fallback wording is present with `rg "falls back to .*title|fallback to .*title|use its \`title\` as the change description"` across the source and generated workflow files.
- [x] 1.2 Update `src/cli/init.ts`'s `addProposeStateAutoload()` so rerunning `lv init` upgrades the legacy injected autoload sentence in already-patched workflow files instead of leaving the stale wording in place, and verify against a legacy-text workflow file that exactly one LV autoload instruction remains and it contains the fallback-aware text.

## 2. Refresh tracked workflow artifacts and verify behavior

- [x] 2.1 Refresh the tracked propose workflow files in `.agents/skills/openspec-propose/SKILL.md`, `.claude/skills/openspec-propose/SKILL.md`, and `.claude/commands/opsx/propose.md` so they match the updated LV source text, and verify `rg "use its \`title\` to derive the kebab-case change name and its \`description\` as the change description"` returns no stale copies.
- [x] 2.2 Run `npm run build` and then verify the empty-description branch-context flow by exercising the patched propose instructions against a state file like `docs/changes/recvusbDWII4py/state.yaml`, confirming the workflow can proceed from `title` without asking the engineer to restate the change.
