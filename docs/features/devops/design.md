<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# devops

## Architecture and Layers

Four independent concerns share the `devops` feature bucket: a runtime observability layer (tracing), a packaging/distribution layer (npm publishing metadata), and two CI automation layers (archive-on-merge, release-to-npm). None depends on the others.

**Tracing:**
- **Configuration layer**: `src/types.ts` defines `ConfigSchema`, including `tracing`; `src/config.ts` loads/normalizes config and exposes `isTracingEnabled()`/`getLvDbPath()`.
- **Mastra runtime layer**: `src/mastra/index.ts` creates the shared `Mastra` instance, the LibSQL storage, and the observability wiring, plus `registerAgent()`.
- **Agent layer**: `src/cli/start.ts` is now the only agent-construction site — `featureMatchAgent`/`featureSplitAgent`, module-level throwaway single-shot `Agent` instances registered via `registerAgent()`. `lv bootstrap` (`src/cli/bootstrap.ts`) constructs no agent of its own.

**npm publishing (metadata):**
- **Package metadata layer**: `package.json` (`license`, `repository`, `keywords`, `publishConfig`, `files`, `scripts.prepublishOnly`, `engines.node`) — no source code involved, purely npm-tooling configuration.
- **Build layer**: `tsup src/index.ts --format esm --dts` (the existing `npm run build` script) produces `dist/index.js` (ESM, shebang preserved from `src/index.ts`), `dist/index.d.ts`, and content-hashed `dist/*.js` chunks.
- **Documentation layer**: `README.md`'s "Get started" and "Installation" sections.

**CI archive-on-merge:**
- **Trigger/workflow layer**: `.github/workflows/archive-on-merge.yml`, a single `archive-and-sync` job on `pull_request: closed`, gated by `github.event.pull_request.merged == true && github.event.pull_request.base.ref == github.event.repository.default_branch`.
- **Resolution layer**: `scripts/ci/resolve-merged-change.mjs`, a standalone Node script (plain Node + `js-yaml`) invoked as a workflow step. It reads `docs/changes/*/state.yaml` directly and writes `change-id`/`openspec-changes`/`feature-ids` to `$GITHUB_OUTPUT`.
- **Archive layer**: the OpenSpec CLI, installed pinned to the root `.openspec-version` file, invoked as `openspec archive "<name>" --yes --json` per resolved change name.
- **Doc-refresh layer**: the Claude Code CLI, authenticated via the `CLAUDE_CODE_OAUTH_TOKEN` secret, invoked as `claude -p "..."` per resolved feature ID to run the `lv-bootstrap` skill headlessly.
- **Commit layer**: stages `openspec/` and `docs/`, commits under `github-actions[bot]` only if the staged diff is non-empty, pushes, retries once with `git pull --rebase` on a push conflict.

**CI release-to-npm:**
- **Trigger layer**: `.github/workflows/release-npm.yml`, a single `publish` job on `release: { types: [published] }` — fires only when a GitHub Release transitions into "published", not on a bare tag push or a draft/pre-release save.
- **Verification layer**: `npm ci` → a version-match shell step → `npx tsc --noEmit` → `npm run build`, run against the exact commit the release tag points at (via `actions/checkout@v4`'s default ref for a `release` event).
- **Auth layer**: `permissions: id-token: write` plus `actions/setup-node@v4`'s `registry-url: "https://registry.npmjs.org"`, which together let `npm publish` use npm Trusted Publishing (OIDC) — no `NODE_AUTH_TOKEN`/`NPM_TOKEN` anywhere in the workflow.
- **npm-CLI-upgrade layer**: an explicit `npm install -g npm@latest` step, since OIDC Trusted Publishing needs npm ≥ 11.5.1 and the workflow doesn't want to depend on exactly which npm version a given Node 24 build happens to bundle.
- **Publish layer**: `npm publish`, which also triggers `prepublishOnly` (`npm run build`) as a fast no-op safety net since the build step already ran.

**Feature-doc layer** (shared by all four): `docs/features/devops/overview.md` and `docs/features/devops/design.md`.

## Data Model / Schema

**Tracing:**
- `ConfigSchema.tracing` is optional; `TracingConfigSchema` contains `enabled: boolean`, defaulting to `true`.
- The Mastra runtime uses the LibSQL database path returned by `getLvDbPath()` as its shared storage backend.

**npm publishing (metadata):**
- `package.json` fields relevant to publishing: `license` (string), `repository` (npm normalizes a `github:` shorthand string into `{ type: "git", url: "git+https://..." }`), `keywords` (string array), `publishConfig.access` (`"public"`), `files` (string array of paths/globs included in the publish tarball), `bin.lv` (path to the executable), `scripts.prepublishOnly` (lifecycle script npm runs automatically before `npm publish`, not `npm pack`), `engines.node` (semver range, informational for `npm install`/`npm ci`, not enforced by CI's own `node-version` pin).
- No other data model exists for this half of the feature.

**CI archive-on-merge:**
- `docs/changes/<change-id>/state.yaml`'s `branch`, `openspec_changes`, and `feature_ids` are the sole inputs the resolution script reads.
- The resolution script's outputs (`change-id: string`, `openspec-changes: string` (JSON array), `feature-ids: string` (JSON array)) are plain `$GITHUB_OUTPUT` key/value lines.
- The root `.openspec-version` file is a single line of plain text (e.g. `1.12.0`).

**CI release-to-npm:**
- No new persisted schema. The workflow reads two existing values at runtime: the GitHub Release event's `tag_name` (a string like `v1.2.3`) and `package.json`'s `version` field (read via `node -p "require('./package.json').version"`, not `jq`, to avoid an extra dependency).
- The npm-side "trust relationship" (Trusted Publisher entry: org/user + repo + workflow filename) lives entirely in npm's own registry configuration for the package — not in this repo, not in a GitHub secret.

## APIs / Interfaces

**Tracing:**
- `registerAgent<T extends Agent>(agent: T): T` in `src/mastra/index.ts`.
- `Config.tracing.enabled` in `src/types.ts`/`src/config.ts`.

**npm publishing (metadata):**
- No runtime API — the "interface" is the npm CLI contract: `npm publish` (reads `files`, runs `prepublishOnly`, applies `publishConfig`), `npm pack [--dry-run]` (reads `files`, does NOT run `prepublishOnly`), `npm install -g lv-engineer-crew` (end-user entry point).

**CI archive-on-merge:**
- `scripts/ci/resolve-merged-change.mjs <branch-name>` (or `MERGED_BRANCH` env var) — CLI entry point; writes to `$GITHUB_OUTPUT` if set, else prints `key=value` lines to stdout.
- No new `lv` CLI surface — calls existing `lv bootstrap <id> --context`/`--finalize` (via the `lv-bootstrap` skill) and the existing `openspec archive`/`claude -p` CLIs.

**CI release-to-npm:**
- No new `lv` CLI surface and no new script — the workflow's only interfaces are the npm CLI (`npm ci`, `npm publish`, `npm install -g npm@latest`), the TypeScript compiler (`npx tsc --noEmit`), and GitHub's own `release` webhook event payload (`github.event.release.tag_name`).

## Key Design Decisions

**Tracing:**
- Single shared Mastra instance: all `lv`-constructed agents funnel through one shared instance so tracing is centralized.
- Boolean-only tracing control, not a richer exporter configuration.
- Storage-backed observability via `MastraStorageExporter`, keeping setup local and consistent with existing LibSQL storage.
- Idempotent registration fallback: `registerAgent()` catches a duplicate-id error from `mastra.addAgent()` and returns the already-registered agent instead.

**npm publishing (metadata):**
- `files` whitelist over `.npmignore`: colocated in `package.json`, easier to keep in sync with the build.
- `prepublishOnly` (not `prepare`) triggers the build: `prepare` also runs on plain `npm install`, which `prepublishOnly` avoids since it only fires for `npm publish`.
- `repository` uses the existing `origin` remote rather than a second, separately maintained URL.
- License MIT and registry public npmjs.org, both explicit choices made when this capability was proposed.
- README keeps both an npm-install path (end users) and the clone/build/`npm link` path (contributors).

**CI archive-on-merge:**
- Trigger on `pull_request: closed` guarded by `merged == true`, not `push` to the default branch — the PR-closed event payload directly exposes the merged branch's name (`head.ref`) with no extra API call.
- Raw `openspec archive --yes --json` CLI, not a headless `/opsx:archive` agent run — the generated `/opsx:archive` command prompts for confirmation in several places, which is non-deterministic with no human present in headless `claude -p` mode.
- Change/feature resolution as a small standalone script, not a new `lv` subcommand — kept CI-only per the proposal's scope.
- A single pinned-version file (`.openspec-version`) rather than hardcoding the OpenSpec CLI version inline in the workflow YAML.
- Headless doc refresh authenticated via `claude setup-token`'s long-lived `CLAUDE_CODE_OAUTH_TOKEN`, not `ANTHROPIC_API_KEY` — matches an existing Claude subscription rather than metered API billing.
- Direct push to the default branch, skip if nothing changed, with one rebase-and-retry on a push conflict — chosen over opening a follow-up PR to keep the loop fully automated.
- Idempotency via directory-existence check before archiving a given change name.

**CI release-to-npm:**
- Trigger on `release: { types: [published] }`, not `push: { tags: 'v*' }` — chosen so every publish goes through GitHub's Release UI/`gh release create`, giving each release a human-readable changelog entry and a single object that both triggers CI and documents the release; a bare tag push would lose the Release-notes artifact.
- Version-match gate compares the release tag to `package.json`'s `version` before any build/publish step — catches the most likely human error in a manual-versioning flow (cutting a release for the wrong commit, or forgetting to bump `package.json`), and fails fast rather than after a build.
- Auth via npm Trusted Publishing (OIDC), not a stored `NPM_TOKEN` secret — required, not just preferred: npm is removing the "bypass 2FA" option on classic Automation tokens that a non-interactive CI publish would otherwise depend on. A granular access token with 2FA-bypass disabled was considered and rejected: still a long-lived stored secret requiring manual rotation, exactly the maintenance burden Trusted Publishing exists to remove.
- Explicit `npm install -g npm@latest` step before publish — Trusted Publishing needs npm ≥ 11.5.1, and the workflow upgrades explicitly rather than assuming the runner's bundled npm is new enough.
- `permissions: { contents: read, id-token: write }`, no `contents: write` — unlike `archive-on-merge.yml`, this workflow never commits or pushes to git, so it gets no elevated `contents` permission; `id-token: write` is the one permission Trusted Publishing's OIDC exchange requires.
- No automated version bumping, changelog generation, or conventional-commit enforcement — versioning and release-note authorship stay a manual, maintainer-driven step (`npm version` + the GitHub Release UI), an explicit scope boundary rather than an oversight.
