<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# devops

## Architecture and Layers

Two independent concerns share the `devops` feature bucket: a runtime observability layer (tracing) and a packaging/distribution layer (npm publishing). Neither depends on the other.

**Tracing:**
- **Configuration layer**: `src/types.ts` defines `ConfigSchema`, including `tracing`; `src/config.ts` loads/normalizes config and exposes `isTracingEnabled()`/`getLvDbPath()`.
- **Mastra runtime layer**: `src/mastra/index.ts` creates the shared `Mastra` instance, the LibSQL storage, and the observability wiring, plus `registerAgent()`.
- **Agent layer**: `src/cli/start.ts` is now the only agent-construction site — `featureMatchAgent`/`featureSplitAgent`, module-level throwaway single-shot `Agent` instances registered via `registerAgent()`. `lv bootstrap` (`src/cli/bootstrap.ts`) constructs no agent of its own.

**npm publishing:**
- **Package metadata layer**: `package.json` (`license`, `repository`, `keywords`, `publishConfig`, `files`, `scripts.prepublishOnly`) — no source code involved, purely npm-tooling configuration.
- **Build layer**: `tsup src/index.ts --format esm --dts` (the existing `npm run build` script, unchanged by this feature) produces `dist/index.js` (ESM, shebang preserved from `src/index.ts`), `dist/index.d.ts`, and content-hashed `dist/*.js` chunks.
- **Documentation layer**: `README.md`'s "Get started" and "Installation" sections.

**Feature-doc layer** (shared by both): `docs/features/devops/overview.md` and `docs/features/devops/design.md`.

## Data Model / Schema

**Tracing:**
- `ConfigSchema.tracing` is optional; `TracingConfigSchema` contains `enabled: boolean`, defaulting to `true`.
- The Mastra runtime uses the LibSQL database path returned by `getLvDbPath()` as its shared storage backend.

**npm publishing:**
- `package.json` fields relevant to publishing: `license` (string), `repository` (npm normalizes a `github:` shorthand string into `{ type: "git", url: "git+https://..." }` on publish/`npm pkg fix` — either form is valid input), `keywords` (string array), `publishConfig.access` (`"public"`), `files` (string array of paths/globs included in the publish tarball; overrides the `.gitignore`-based default-inclusion fallback npm uses when `files` and `.npmignore` are both absent), `bin.lv` (path to the executable, normalized to a plain relative path with no leading `./`), `scripts.prepublishOnly` (a lifecycle script name npm runs automatically before `npm publish` — not before `npm pack`).
- No other data model exists for this half of the feature; there is no server-side schema, no database table.

## APIs / Interfaces

**Tracing:**
- `registerAgent<T extends Agent>(agent: T): T` in `src/mastra/index.ts`.
- `Config.tracing.enabled` in `src/types.ts`/`src/config.ts`.

**npm publishing:**
- No runtime API — the "interface" is the npm CLI contract: `npm publish` (reads `files`, runs `prepublishOnly`, applies `publishConfig`), `npm pack [--dry-run]` (reads `files`, does NOT run `prepublishOnly`), `npm install -g lv-engineer-crew` (the end-user-facing entry point, installs the `lv` bin globally from the published tarball).

## Key Design Decisions

**Tracing:**
- Single shared Mastra instance: all `lv`-constructed agents funnel through one shared instance so tracing is centralized.
- Boolean-only tracing control, not a richer exporter configuration.
- Storage-backed observability via `MastraStorageExporter`, keeping setup local and consistent with existing LibSQL storage.
- Idempotent registration fallback: `registerAgent()` catches a duplicate-id error from `mastra.addAgent()` and returns the already-registered agent instead, so a factory that can run more than once per process (e.g. module re-evaluation in tests) stays safe.

**npm publishing:**
- `files` whitelist over `.npmignore`: colocated in `package.json`, easier to keep in sync with the build than a separate ignore file, and avoids relying on the `.gitignore`-fallback behavior that would otherwise silently exclude the gitignored `dist/` from the tarball.
- `prepublishOnly` (not `prepare`) triggers the build: `prepare` also runs on plain `npm install` inside this repo (including CI/dev installs that don't need a build), which `prepublishOnly` avoids since it only fires for `npm publish`.
- `repository` uses the existing `origin` remote (`github:dragonlong206/lv-engineering-crew`) rather than a second, separately maintained URL.
- License MIT and registry public npmjs.org, both explicit choices made when this capability was proposed (see the archived `publish-npm-package-and-update-readme` change) rather than defaults inferred by tooling.
- README keeps both an npm-install path (end users) and the clone/build/`npm link` path (contributors) rather than replacing one with the other, since contributors working on `lv` itself still need a source build.
