<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# devops

## Architecture and Layers

Three independent concerns share the `devops` feature bucket: a runtime observability layer (tracing), a packaging/distribution layer (npm publishing), and a CI automation layer (archive-on-merge). None depends on the others.

**Tracing:**
- **Configuration layer**: `src/types.ts` defines `ConfigSchema`, including `tracing`; `src/config.ts` loads/normalizes config and exposes `isTracingEnabled()`/`getLvDbPath()`.
- **Mastra runtime layer**: `src/mastra/index.ts` creates the shared `Mastra` instance, the LibSQL storage, and the observability wiring, plus `registerAgent()`.
- **Agent layer**: `src/cli/start.ts` is now the only agent-construction site — `featureMatchAgent`/`featureSplitAgent`, module-level throwaway single-shot `Agent` instances registered via `registerAgent()`. `lv bootstrap` (`src/cli/bootstrap.ts`) constructs no agent of its own.

**npm publishing:**
- **Package metadata layer**: `package.json` (`license`, `repository`, `keywords`, `publishConfig`, `files`, `scripts.prepublishOnly`) — no source code involved, purely npm-tooling configuration.
- **Build layer**: `tsup src/index.ts --format esm --dts` (the existing `npm run build` script, unchanged by this feature) produces `dist/index.js` (ESM, shebang preserved from `src/index.ts`), `dist/index.d.ts`, and content-hashed `dist/*.js` chunks.
- **Documentation layer**: `README.md`'s "Get started" and "Installation" sections.

**CI archive-on-merge:**
- **Trigger/workflow layer**: `.github/workflows/archive-on-merge.yml`, a single `archive-and-sync` job on `pull_request: closed`, gated by `github.event.pull_request.merged == true && github.event.pull_request.base.ref == github.event.repository.default_branch`.
- **Resolution layer**: `scripts/ci/resolve-merged-change.mjs`, a standalone Node script (plain Node + `js-yaml`, both already `package.json` dependencies) invoked as a workflow step — not a new `lv` subcommand. It reads `docs/changes/*/state.yaml` directly and writes `change-id`/`openspec-changes`/`feature-ids` to `$GITHUB_OUTPUT`.
- **Archive layer**: the OpenSpec CLI, installed in the runner pinned to the root `.openspec-version` file's contents, invoked as `openspec archive "<name>" --yes --json` per resolved change name — a raw CLI call, not a headless `/opsx:archive` agent run.
- **Doc-refresh layer**: the Claude Code CLI, installed in the runner and authenticated via the `CLAUDE_CODE_OAUTH_TOKEN` secret, invoked as `claude -p "..."` per resolved feature ID to run the existing `lv-bootstrap` skill headlessly (scoped with `--add-dir`/`--allowedTools "Bash(lv bootstrap:*) Read Glob Grep Write Edit"`). `lv` itself is built and `npm link`ed from source in the same job so the skill's `lv bootstrap <id> --context`/`--finalize` calls resolve to the runner's checkout.
- **Commit layer**: a final workflow step that stages `openspec/` and `docs/`, commits under a `github-actions[bot]` identity only if the staged diff is non-empty, pushes, and retries once with `git pull --rebase` on a push conflict.

**Feature-doc layer** (shared by all three): `docs/features/devops/overview.md` and `docs/features/devops/design.md`.

## Data Model / Schema

**Tracing:**
- `ConfigSchema.tracing` is optional; `TracingConfigSchema` contains `enabled: boolean`, defaulting to `true`.
- The Mastra runtime uses the LibSQL database path returned by `getLvDbPath()` as its shared storage backend.

**npm publishing:**
- `package.json` fields relevant to publishing: `license` (string), `repository` (npm normalizes a `github:` shorthand string into `{ type: "git", url: "git+https://..." }` on publish/`npm pkg fix` — either form is valid input), `keywords` (string array), `publishConfig.access` (`"public"`), `files` (string array of paths/globs included in the publish tarball; overrides the `.gitignore`-based default-inclusion fallback npm uses when `files` and `.npmignore` are both absent), `bin.lv` (path to the executable, normalized to a plain relative path with no leading `./`), `scripts.prepublishOnly` (a lifecycle script name npm runs automatically before `npm publish` — not before `npm pack`).
- No other data model exists for this half of the feature; there is no server-side schema, no database table.

**CI archive-on-merge:**
- `docs/changes/<change-id>/state.yaml`'s `branch` (exact string, matched against the merged PR's `head.ref`), `openspec_changes` (string array of OpenSpec change names to archive), and `feature_ids` (string array of feature IDs to refresh) are the sole inputs the resolution script reads — no new schema is introduced.
- The resolution script's outputs (`change-id: string`, `openspec-changes: string` (JSON array), `feature-ids: string` (JSON array)) are plain `$GITHUB_OUTPUT` key/value lines, consumed by later workflow steps via `steps.resolve.outputs.*` and `jq -r '.[]'`.
- The root `.openspec-version` file is a single line of plain text (e.g. `1.12.0`), read via `cat .openspec-version` in the workflow.

## APIs / Interfaces

**Tracing:**
- `registerAgent<T extends Agent>(agent: T): T` in `src/mastra/index.ts`.
- `Config.tracing.enabled` in `src/types.ts`/`src/config.ts`.

**npm publishing:**
- No runtime API — the "interface" is the npm CLI contract: `npm publish` (reads `files`, runs `prepublishOnly`, applies `publishConfig`), `npm pack [--dry-run]` (reads `files`, does NOT run `prepublishOnly`), `npm install -g lv-engineer-crew` (the end-user-facing entry point, installs the `lv` bin globally from the published tarball).

**CI archive-on-merge:**
- `scripts/ci/resolve-merged-change.mjs <branch-name>` (or `MERGED_BRANCH` env var) — CLI entry point, not an importable module; writes to `$GITHUB_OUTPUT` if set, else prints `key=value` lines to stdout.
- No new `lv` CLI surface — the workflow only calls existing `lv bootstrap <id> --context`/`--finalize` (via the `lv-bootstrap` skill's own instructions) and the existing `openspec archive`/`claude -p` CLIs.

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

**CI archive-on-merge:**
- Trigger on `pull_request: closed` guarded by `merged == true`, not `push` to the default branch — the PR-closed event payload directly exposes the merged branch's name (`head.ref`) with no extra API call, and cleanly excludes non-merge direct pushes to the default branch.
- Raw `openspec archive --yes --json` CLI, not a headless `/opsx:archive` agent run — inspecting the generated `/opsx:archive` command shows it reimplements the archive as agent-driven steps that prompt for confirmation in several places (incomplete tasks, sync strategy), which is non-deterministic with no human present in headless `claude -p` mode; it would also need much broader tool permissions than the doc-refresh step's narrow `Bash(lv bootstrap:*) Read Glob Grep Write Edit` scope.
- Change/feature resolution as a small standalone script (`scripts/ci/resolve-merged-change.mjs`), not a new `lv` subcommand — kept CI-only per the proposal's scope, and the exact `branch` string in `state.yaml` makes `matchBranch()`'s pattern-inference unnecessary here.
- A single pinned-version file (`.openspec-version`) rather than hardcoding the OpenSpec CLI version inline in the workflow YAML — easier to discover and bump, and reusable if a second workflow needs the same version.
- Headless doc refresh authenticated via `claude setup-token`'s long-lived `CLAUDE_CODE_OAUTH_TOKEN`, not `ANTHROPIC_API_KEY` — matches running under an existing Claude subscription rather than metered API billing, per explicit user decision.
- Direct push to the default branch, skip if nothing changed, with one rebase-and-retry on a push conflict — chosen over opening a follow-up PR per explicit user decision to keep the loop fully automated; the diff is scoped strictly to `openspec/` and `docs/` so it stays auditable after the fact even without a review gate.
- Idempotency via directory-existence check: before archiving a given change name, the workflow checks whether `openspec/changes/<name>/` still exists (`openspec archive` removes it on success) and skips if it's already gone, so a re-run after a partial failure doesn't error on already-archived changes.
