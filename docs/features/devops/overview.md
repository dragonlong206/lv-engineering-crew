<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# devops

## Purpose of the Feature

The `devops` feature is the documentation and change-management context used for repository work that centers on LV's infrastructure and operational capabilities. In the current codebase, the concrete example tied to this feature is enabling Mastra tracing so agent runs can be observed through the existing `npm run mastra` dev server.

## Main Components

- `docs/features/devops/overview.md` and `docs/features/devops/design.md`, which are the feature docs that `lv bootstrap` can generate and refine.
- `docs/features/INDEX.md`, which registers `devops` in the feature catalog.
- `docs/changes/<change-id>/state.yaml`, which stores change context for work that maps to this feature.
- Mastra wiring in `src/mastra/index.ts`, which creates the shared `Mastra` instance, storage, optional observability, and `registerAgent()` helper.
- Agent construction sites in `src/agents/bootstrap-agent.ts` and `src/cli/bootstrap.ts`, plus the workflow agents in `src/cli/start.ts`, which all use the shared Mastra registration path.
- Configuration definitions in `src/types.ts` and loading helpers in `src/config.ts`, including the `tracing` config block.

## High-level Flow

1. A change is created or updated in `docs/changes/<change-id>/state.yaml`.
2. Feature docs for `devops` are kept in `docs/features/devops/` and can be regenerated from the codebase by `lv bootstrap devops`.
3. The shared Mastra instance is created from repository config, with tracing enabled or disabled according to `tracing.enabled`.
4. Agents are registered on that shared instance through `registerAgent()` so their runs participate in observability.
5. When tracing is enabled, agent activity is written to the Mastra storage-backed observability path and can be inspected through the Mastra dev server.

## Constraints and Assumptions

- Tracing is controlled by a single boolean toggle, `tracing.enabled`, which defaults to `true`.
- The tracing path is local and storage-backed through LibSQL, not an external observability service.
- Observability applies to Mastra agent runs only, not to git, Lark, or CLI timing.
- `registerAgent()` is designed to tolerate repeated registration of the same agent ID in one process by returning the already-registered agent.
- The feature docs are auto-generated but are meant to be reviewed and edited before committing.

## Current State of the Code

The codebase already contains the plumbing that makes the `devops`-related tracing work real: `src/mastra/index.ts` exports the shared Mastra instance with conditional observability and the `registerAgent()` helper, `src/types.ts` defines `tracing.enabled`, and the bootstrap/start command paths register their agents through that shared instance. The `devops` docs themselves are present but mostly draft-level, and `docs/features/INDEX.md` already links to the feature.
