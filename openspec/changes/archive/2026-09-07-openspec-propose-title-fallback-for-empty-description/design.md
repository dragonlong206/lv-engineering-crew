## Context

See `proposal.md` - Why. The affected behavior lives in `lv-init`'s propose-specific workflow patching, not in `lv start` or the `state.yaml` schema. Today `src/prompts.ts` defines `PROPOSE_STATE_AUTOLOAD_LINE` with wording that only treats `state.yaml.description` as the usable description source, and `src/cli/init.ts`'s `addProposeStateAutoload()` only checks whether the current line is already present before inserting it. That means changing the constant alone would help freshly generated workflow files, but any already-patched file that still contains the old wording would not be updated by a later `lv init`.

## Goals / Non-Goals

**Goals:**
- Update the canonical LV prompt text so the intended source order is explicit: derive the change name from `title`, use `description` when present, otherwise fall back to `title`.
- Make the patching path resilient for repos that already contain the older injected wording, so rerunning `lv init` converges existing workflow files onto the new instruction instead of leaving stale text in place.
- Keep the change limited to the propose workflow files that already participate in LV's custom patching flow.

**Non-Goals:**
- Changing how `lv start` writes `state.yaml`; this proposal assumes `title` remains the always-available primary context field for the branch.
- Introducing a new generic templating system for all propose-specific patches; this fix should stay within the current regex-and-string patch approach unless implementation discovers it is impossible.
- Changing non-propose workflows or the generic `openspec/config.yaml` context pointer.

## Decisions

**Treat the fallback as a prompt-contract change in `PROPOSE_STATE_AUTOLOAD_LINE`.** The behavior users experience comes from the installed workflow text, so the canonical source of truth should remain the existing constant in `src/prompts.ts`. Alternative considered: handle the fallback only in this repo's checked-in workflow files. Rejected because `lv init` would continue installing the broken wording into other repos.

**Teach `addProposeStateAutoload()` to replace the legacy line as well as insert the new one.** The existing idempotency check only recognizes the exact current constant and otherwise inserts a new line before the "ask the user" anchor. With this bug, many workflow files are already patched once with the old line, so implementation should detect the legacy LV autoload instruction and rewrite it in place to the new text rather than leaving the stale copy untouched. Alternative considered: require engineers to regenerate the workflow files from scratch before rerunning `lv init`. Rejected because the whole point of the patcher is to converge generated files idempotently.

**Keep the anchor and file set unchanged.** The same `PROPOSE_ASK_USER_LINE_RE` anchor and `PROPOSE_WORKFLOW_FILES` list already cover the generated Codex and Claude propose workflows tracked in this repo. This fix changes only the inserted line's semantics and the patcher's ability to upgrade old injected text; it does not need a new insertion point or a broader file search.

**Update the checked-in generated workflow files in this repo for immediate consistency.** This repository currently tracks `.agents/skills/openspec-propose/SKILL.md`, `.claude/skills/openspec-propose/SKILL.md`, and `.claude/commands/opsx/propose.md`, all of which embed the old wording today. Even though `lv init` is the long-term propagation path, keeping the checked-in generated artifacts aligned with the new source text avoids misleading future readers and provides a concrete verification target in-repo. Alternative considered: rely solely on a future `lv init` run to refresh them. Rejected because the repo itself would remain visibly inconsistent after the code change.

## Risks / Trade-offs

- [Risk] A replacement routine that matches the legacy text too loosely could rewrite unrelated workflow content. Mitigation: scope replacement to the exact known LV-injected autoload sentence, normalized the same way the current idempotency checks already compare text.
- [Risk] OpenSpec may regenerate the "ask the user" step with small wording changes over time, which could still break insertion for entirely new files. Mitigation: keep the existing regex that already handles both "no input" and "no clear input" variants, and limit this change to upgrading the LV-owned injected line rather than expanding into broader parsing.
- [Risk] Rewriting tracked generated workflow files increases the surface area of the code change slightly. Mitigation: the files are already LV-maintained artifacts, and aligning them with the source constant reduces long-term confusion.

## Migration Plan

No data migration is needed. After implementation, rerunning `lv init` in an LV-enabled repo should refresh any previously patched propose workflow files from the legacy no-fallback instruction to the new fallback-aware wording.
