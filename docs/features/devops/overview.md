<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# devops

## Purpose of the Feature

The `devops` feature is the documentation and change-management context used for repository work that centers on LV's own infrastructure and operational capabilities, as opposed to a `lv` subcommand's behavior. Two concrete examples currently live under this feature: enabling Mastra tracing so agent runs can be observed through the `npm run mastra` dev server, and making the `lv-engineer-crew` package installable from the public npm registry (package metadata, a `LICENSE`, and README install instructions).

## Main Components

- `docs/features/devops/overview.md` and `docs/features/devops/design.md`, the feature docs that `lv bootstrap`/the `lv-bootstrap` skill can generate and refine.
- `docs/features/INDEX.md`, which registers `devops` in the feature catalog.
- `docs/changes/<change-id>/state.yaml`, which stores change context for work that maps to this feature.
- **Tracing**: Mastra wiring in `src/mastra/index.ts`, which creates the shared `Mastra` instance, storage, optional observability, and the `registerAgent()` helper; the `tracing` config block in `src/types.ts`/`src/config.ts`; the two agent-construction sites that call `registerAgent()` — `featureMatchAgent`/`featureSplitAgent`, module-level `Agent` instances in `src/cli/start.ts`. (`lv bootstrap` no longer constructs any agent itself — see Current State of the Code below.)
- **npm publishing**: `package.json`'s `license`, `repository`, `keywords`, `publishConfig.access`, `files` (whitelisting `dist`, `README.md`, `LICENSE` for the publish tarball since `dist/` is `.gitignore`d), and `scripts.prepublishOnly` (runs `npm run build` before `npm publish`); the root `LICENSE` file; the `README.md` "Get started"/"Installation" sections documenting `npm install -g lv-engineer-crew` for end users alongside the clone/build/`npm link` path for contributors.

## High-level Flow

**Tracing:**
1. The shared Mastra instance in `src/mastra/index.ts` is created from repository config, with tracing enabled or disabled according to `tracing.enabled`.
2. Agents are registered on that shared instance through `registerAgent()` so their runs participate in observability.
3. When tracing is enabled, agent activity is written to the Mastra storage-backed observability path and can be inspected through the Mastra dev server.

**npm publishing:**
1. A maintainer runs `npm publish` (manual, not automated by any `lv` command or CI workflow).
2. `prepublishOnly` runs `npm run build` first, so `dist/` is always fresh regardless of the local working tree state.
3. npm packs the tarball using the `files` whitelist (`dist`, `README.md`, `LICENSE`), so the tarball contains a working `dist/` even though `dist/` itself is gitignored.
4. An end user installs the published package with `npm install -g lv-engineer-crew`, documented in `README.md`.

## Constraints and Assumptions

- Tracing is controlled by a single boolean toggle, `tracing.enabled`, which defaults to `true`.
- The tracing path is local and storage-backed through LibSQL, not an external observability service.
- Observability applies to Mastra agent runs only (`lv start`'s feature-match/feature-split agents), not to git, Lark, or CLI timing.
- `registerAgent()` is designed to tolerate repeated registration of the same agent ID in one process by returning the already-registered agent.
- npm publishing is a manual, maintainer-run step; there is no CI/CD workflow that runs `npm publish` automatically, and none is planned as part of this feature's current scope.
- The published package is public and unscoped (`lv-engineer-crew` on the public npm registry), licensed MIT.
- The feature docs are auto-generated but are meant to be reviewed and edited before committing.

## Current State of the Code

Tracing: `src/mastra/index.ts` exports the shared Mastra instance with conditional observability and the `registerAgent()` helper, `src/types.ts` defines `tracing.enabled`, and `src/cli/start.ts`'s `featureMatchAgent`/`featureSplitAgent` register through that shared instance. There is no `src/agents/` directory anymore, and `src/cli/bootstrap.ts` does not construct or register any agent — `lv bootstrap`'s own docs generation is the `lv-bootstrap` skill/command running inside the calling coding agent's turn, not a Mastra `Agent` `lv` itself calls.

npm publishing: `package.json` carries `license: "MIT"`, a `repository` field (npm-normalized to the object form pointing at `github.com/dragonlong206/lv-engineering-crew`), `keywords`, `publishConfig.access: "public"`, `files: ["dist", "README.md", "LICENSE"]`, and `scripts.prepublishOnly: "npm run build"`. A root `LICENSE` file (MIT) exists. `README.md`'s "Get started" and "Installation" sections lead with `npm install -g lv-engineer-crew` for end users and keep the git-clone/build/`npm link` sequence as the contributor path. `docs/features/INDEX.md` already links to the `devops` feature.
