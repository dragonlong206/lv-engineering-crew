## Why

Some Lark tickets carry a UI design reference — a Figma link, an HTML prototype, or an attached image/PDF — that describes what the change should look like. `lv start` currently drops this on the floor: `fetchTicket()` only reads the feature ID, title, description, and project link fields, so a ticket's design reference never reaches `state.yaml`, the referenced feature's docs, or the OpenSpec proposal that `/opsx:propose` generates. Engineers have to manually copy the link into the proposal by hand, and it's easy to forget. And even once captured, a bare reference (a URL, a filename) still leaves whoever writes the proposal to manually open Figma or the attached file to see what's actually being asked for — the proposal itself doesn't reflect the design's content, just a pointer to it.

## What Changes

- Add a new optional `.lv.yaml` field, `lark.ui_design_field`, naming the Lark Base column that holds a ticket's UI design reference(s).
- `fetchTicket()` reads that column (when configured) and normalizes whatever shape it comes back as — a plain URL/text field, a Lark attachment field (array of files), or a Lark URL-type field — into a flat list of reference strings on the returned `LarkTicket`. No fetching, downloading, or content analysis of the referenced asset happens in `lv` itself; it captures the reference only.
- `lv start` persists non-empty UI design references into a new optional `ui_design` field on `docs/changes/<change-id>/state.yaml`, alongside `title`/`description`.
- When `lv start` triggers inline feature-doc bootstrap for a referenced feature with no existing `docs/features/<id>/`, it passes the ticket's UI design references into the bootstrap prompt so the generated `overview.md` records them as feature context, not just this one change's context.
- Extend `lv init`'s existing propose-specific patch mechanism — a new `PROPOSE_UI_DESIGN_LINE` (`src/prompts.ts`) applied by a new `addProposeUiDesignInstruction()` (`src/cli/init.ts`), alongside the existing `PROPOSE_STATE_AUTOLOAD_LINE`/`PROPOSE_LINK_CHANGE_LINE` patches into the generated `/opsx:propose` workflow file(s) — so that, specifically when creating the `proposal` artifact, the workflow is instructed to attempt to view or fetch each `ui_design` reference and reflect what it observes in `proposal.md`'s "What Changes"/"Impact" sections — preferring the Figma Dev Mode MCP Server's tools (`get_code`, `get_screenshot`, `get_variable_defs`, etc.) for a Figma URL when one is configured in the engineer's environment, otherwise falling back to `WebFetch` for a URL or reading a local/downloadable image or PDF, and falling back further to citing the raw reference when the asset can't be accessed by any available method. This is the "analyze the UI design and add it to the proposal" half of the request. Deliberately scoped to `/opsx:propose` only, not the generic `context:` pointer every OpenSpec workflow reads: `/opsx:apply`/`/opsx:sync`/`/opsx:archive` produce nothing this instruction is about, so adding it there would only add token overhead to every invocation of those. `lv` itself never fetches or analyzes anything, never writes `proposal.md`, and does not install or configure the Figma MCP server; this analysis happens entirely inside `/opsx:propose`, using whatever tools are already available in the engineer's environment.

## Capabilities

### New Capabilities
- `lv-start/ui-design-capture`: capturing a ticket's UI design reference (Figma link, HTML prototype, image, or PDF) from a configured Lark field into `state.yaml` and into inline-bootstrapped feature docs.

### Modified Capabilities
- `lv-init/openspec-bootstrap`: gains a new requirement (an ADDED requirement in the delta spec, not a change to an existing one) — patching the generated `/opsx:propose` workflow file(s) to analyze a UI design reference when creating the `proposal` artifact. The existing requirements (feature docs / ticket-description context load) are untouched.

## Impact

- `src/types.ts`: `LarkConfigSchema` gains `ui_design_field` (optional, no default); `StateSchema` gains `ui_design` (optional array of strings).
- `src/tools/lark.ts`: `LarkTicket` gains `uiDesignRefs: string[]`; `fetchTicket()` extracts and normalizes the configured field.
- `src/cli/start.ts`: passes `uiDesignRefs` into the persisted state and into the inline-bootstrap hint for referenced features.
- `src/prompts.ts` / `src/cli/bootstrap.ts`: bootstrap prompt building accepts and includes UI design references when present.
- `src/prompts.ts`: new `PROPOSE_UI_DESIGN_LINE` constant — preferring the Figma Dev Mode MCP Server for Figma URLs when configured, falling back to `WebFetch`/`Read`, and falling back further to citing the raw reference on failure, scoped explicitly to the `proposal` artifact.
- `src/cli/init.ts`: new `addProposeUiDesignInstruction()`, patching the generated `/opsx:propose` workflow file(s) (mirroring `addProposeStateAutoload()`/`addProposeLinkInstruction()`), called from `runInit()`.
- `.lv.yaml` (this repo's own, and the template `lv init` documents): new commented-out `ui_design_field` example.
- No breaking changes — the field is optional throughout, and its absence preserves current behavior exactly.
