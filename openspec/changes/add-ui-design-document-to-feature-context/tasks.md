## 1. Config and state schema

- [x] 1.1 Add `ui_design_field: z.string().optional()` to `LarkConfigSchema` in `src/types.ts`, with a comment matching the existing field-documentation style, and verify `npx tsc --noEmit` passes
- [x] 1.2 Add `ui_design: z.array(z.string()).optional()` to `StateSchema` in `src/types.ts` and verify `npx tsc --noEmit` passes
- [x] 1.3 Document `lark.ui_design_field` in `.lv.yaml` as a commented-out example, following the existing style of the other optional `lark.*` fields

## 2. Lark ticket extraction

- [x] 2.1 Add a `normalizeUiDesignRefs(value): string[]` helper in `src/tools/lark.ts` that shape-sniffs the raw field value — string → single entry (trimmed, filtered if empty); array of strings → flattened; array of attachment-like objects → one entry per object using `url` ?? `tmp_url` ?? `name`, skipping objects with none of those; `{text, link}`-shaped URL-field object → `link` ?? `text` — and verify with a quick `npx tsx` script exercising each shape
- [x] 2.2 Add `uiDesignRefs: string[]` to the `LarkTicket` interface in `src/tools/lark.ts`
- [x] 2.3 Extend `fetchTicket()` to accept the configured `uiDesignField` name (mirroring how `featureIdField`/`titleField`/`projectField` are passed in), read `fields[uiDesignField]` when the name is given, normalize it via `normalizeUiDesignRefs()`, and set `uiDesignRefs` (empty array when the field name isn't provided or resolves to nothing)
- [x] 2.4 Update `fetchTicket()`'s call site(s) in `src/cli/start.ts` (and the `larkTicketTool` Mastra tool definition, if it also needs the new parameter) to pass `config.lark.ui_design_field`, and verify `npx tsc --noEmit` passes

## 3. Persist into state.yaml

- [x] 3.1 In `src/cli/start.ts`'s ticket-based start flow, set `state.ui_design` from `ticket.uiDesignRefs` only when non-empty (omit the key otherwise) — verified locally via `StateSchema.parse()` + `yaml.dump()` (matches `writeState()`'s own path) rather than a live `lv start` run, since that has real side effects (branch/commit/Lark write-back) on a real ticket. User confirmed the local check is sufficient; live spot-check deferred to the user when they have a real ticket with a UI design field set.
- [x] 3.2 Verify a ticket with no UI design reference (or `ui_design_field` unset) produces a `state.yaml` with no `ui_design` key — confirmed by the same local check (see 3.1): the key is fully absent, not `ui_design: []`, when `uiDesignRefs` is empty

## 4. Feed references into inline feature bootstrap

- [x] 4.1 Add `uiDesignRefs?: string[]` to `BootstrapScanHint` in `src/cli/bootstrap.ts`
- [x] 4.2 Extend `buildBootstrapScanPrompt()` in `src/prompts.ts` to include a `## UI design references` section (listing the refs) in its output when `uiDesignRefs` is non-empty, alongside the existing `## Feature hint` section
- [x] 4.3 In `src/cli/start.ts`, pass `uiDesignRefs: ticket.uiDesignRefs` through the hint object at the inline-bootstrap call site (`generateFeatureDocsFromScan(...)`) when non-empty
- [x] 4.4 Verify end-to-end: the prompt-building half is verified directly (calling `buildBootstrapScanPrompt()` with sample refs confirms the `## UI design references` section renders, and is absent when no refs are given). A full live run (`lv start` against a real ticket, invoking the bootstrap LLM agent and writing to Lark) was not run — same live-side-effect tradeoff as 3.1/3.2; deferred to the user's own spot-check.

## 5. Patch `/opsx:propose` specifically to analyze the design, via `lv init`

(Revised: an earlier version of this section wired the instruction through the generic `context:` pointer read by every OpenSpec workflow. Corrected to a propose-specific patch instead — only `/opsx:propose` writes `proposal.md`, so putting this on the generic pointer would add token overhead to every `/opsx:apply`/`/opsx:sync`/`/opsx:archive` invocation for no benefit. See design.md's Decisions.)

- [x] 5.1 Add `PROPOSE_UI_DESIGN_LINE` to `src/prompts.ts`: instructs the workflow that, specifically when creating the `proposal` artifact (not the other artifact types), it should attempt to view or fetch each `ui_design` reference and reflect what it observes in `proposal.md`'s "What Changes"/"Impact" sections — for a Figma URL, prefer the Figma Dev Mode MCP Server's tools when one is configured; otherwise `WebFetch`/`Read`; falling back to citing the raw reference string when inaccessible
- [x] 5.2 Add `addProposeUiDesignInstruction()` to `src/cli/init.ts`, patching `PROPOSE_WORKFLOW_FILES` at the same anchor `addProposeStateAutoload()` uses (step 1's "ask the user" line), idempotent like the other two propose patches; call it from `runInit()` alongside `addProposeStateAutoload()`/`addProposeLinkInstruction()`
- [x] 5.3 Verify the patch logic against scratch copies of the real `.claude/commands/opsx/propose.md`/`.claude/skills/openspec-propose/SKILL.md`/`.agents/skills/openspec-propose/SKILL.md`: run 1 inserts the new line into all three (anchor found, correct text), run 2 detects "already patched" (idempotent) in all three
- [x] 5.4 Apply the patch for real to this repo's own three propose workflow files (safe: pure text insertion, no install/network/git side effects) — done directly rather than via a full `lv init` re-run, since that would also re-trigger the OpenSpec CLI install/config flow
- [ ] 5.5 Verify end-to-end: run `/opsx:propose` on a branch whose `state.yaml` has a real, reachable UI design reference (e.g. a public Figma link or a local image) and confirm the generated `proposal.md` reflects actual observed content, not just the raw reference — **deferred**: this repo's propose workflow files are already patched (5.4), so this only needs a live session with a real design asset; left for the user to spot-check

## 6. Documentation

- [x] 6.1 Run `lv bootstrap lv-start` (or otherwise refresh `docs/features/lv-start/{overview.md,design.md}`) to reflect the new UI design capture behavior, then review and commit manually per this repo's convention — ran `npm run dev -- bootstrap lv-start`; refreshed docs correctly reflect `uiDesignRefs`, `ui_design`, `lark.ui_design_field`, and the new `fetchTicket()` signature. Files written, not committed (per this repo's convention) — review and commit manually.
