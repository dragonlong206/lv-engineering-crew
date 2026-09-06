## ADDED Requirements

### Requirement: Propose workflow analyzes a ticket's UI design reference when writing the proposal
When the current change's `docs/changes/<change-id>/state.yaml` has a non-empty `ui_design`, the system SHALL patch the installed `/opsx:propose` workflow file(s) so that, specifically when creating the `proposal` artifact, the workflow attempts to view or fetch the content each reference points to — preferring the Figma Dev Mode MCP Server's tools (e.g. `get_code`, `get_screenshot`, `get_variable_defs`) for a Figma URL when one is configured in the engineer's environment, and otherwise falling back to `WebFetch` (for a URL) or reading a local/downloadable image or PDF — and reflect what it observes in `proposal.md`'s "What Changes" and "Impact" sections, falling back further to citing the raw reference string when the asset can't be accessed by any available method. This instruction SHALL be scoped to the `/opsx:propose` workflow file(s) only, not the generic OpenSpec `context:` pointer that every workflow reads, since only the `proposal` artifact reflects this analysis.

#### Scenario: Figma reference with a Figma MCP server configured
- **WHEN** the engineer runs `/opsx:propose` on a change whose `ui_design` includes a Figma URL, and a Figma Dev Mode MCP Server is configured in their environment
- **THEN** the workflow's patched instructions direct it to prefer that MCP server's tools for that reference, specifically while creating the `proposal` artifact

#### Scenario: Figma reference with no Figma MCP server configured
- **WHEN** the engineer runs `/opsx:propose` on a change whose `ui_design` includes a Figma URL, and no Figma MCP server is configured
- **THEN** the workflow falls back to `WebFetch` for that reference, and further falls back to citing the raw URL if that yields nothing usable

#### Scenario: No UI design reference
- **WHEN** the engineer runs `/opsx:propose` on a change whose `state.yaml` has no `ui_design`
- **THEN** no UI-design-specific instruction has any effect, and proposal creation behaves exactly as it did before this capability existed

#### Scenario: Other OpenSpec workflows are unaffected
- **WHEN** the engineer runs `/opsx:apply`, `/opsx:sync`, or `/opsx:archive` on a change whose `state.yaml` has a non-empty `ui_design`
- **THEN** that workflow's instructions carry no UI-design-analysis instruction, since only the `/opsx:propose` workflow file(s) are patched with it
