<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

# devops

## Purpose of the Feature

The `devops` feature is the documentation and change-management context used for repository work that centers on LV's own infrastructure and operational capabilities, as opposed to a `lv` subcommand's behavior. Three concrete capabilities currently live under this feature: enabling Mastra tracing so agent runs can be observed through the `npm run mastra` dev server, making the `lv-engineer-crew` package installable from the public npm registry (package metadata, a `LICENSE`, and README install instructions), and a GitHub Actions workflow that automatically archives merged OpenSpec changes and refreshes feature docs on PR merge.

## Main Components

- `docs/features/devops/overview.md` and `docs/features/devops/design.md`, the feature docs that `lv bootstrap`/the `lv-bootstrap` skill can generate and refine.
- `docs/features/INDEX.md`, which registers `devops` in the feature catalog.
- `docs/changes/<change-id>/state.yaml`, which stores change context for work that maps to this feature.
- **Tracing**: Mastra wiring in `src/mastra/index.ts`, which creates the shared `Mastra` instance, storage, optional observability, and the `registerAgent()` helper; the `tracing` config block in `src/types.ts`/`src/config.ts`; the two agent-construction sites that call `registerAgent()` — `featureMatchAgent`/`featureSplitAgent`, module-level `Agent` instances in `src/cli/start.ts`. (`lv bootstrap` no longer constructs any agent itself — see Current State of the Code below.)
- **npm publishing**: `package.json`'s `license`, `repository`, `keywords`, `publishConfig.access`, `files` (whitelisting `dist`, `README.md`, `LICENSE` for the publish tarball since `dist/` is `.gitignore`d), and `scripts.prepublishOnly` (runs `npm run build` before `npm publish`); the root `LICENSE` file; the `README.md` "Get started"/"Installation" sections documenting `npm install -g lv-engineer-crew` for end users alongside the clone/build/`npm link` path for contributors.
- **CI archive-on-merge**: `.github/workflows/archive-on-merge.yml`, the first GitHub Actions workflow in this repo, triggered when a PR merges into the default branch; `scripts/ci/resolve-merged-change.mjs`, a standalone Node script that maps the merged branch back to its `docs/changes/<change-id>/state.yaml`; the root `.openspec-version` file pinning the OpenSpec CLI version the workflow installs; the `README.md` "CI: archive & doc sync on merge" section documenting version pinning and the `claude setup-token`/`CLAUDE_CODE_OAUTH_TOKEN` credential setup.

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

**CI archive-on-merge:**
1. A PR is merged into the repo's default branch, firing the workflow (`pull_request: closed`, gated on `merged == true` and the PR's base being the default branch).
2. `scripts/ci/resolve-merged-change.mjs "<merged-branch>"` scans `docs/changes/*/state.yaml` for the entry whose `branch` field matches the merged branch, and writes that entry's `openspec_changes` and `feature_ids` to `$GITHUB_OUTPUT` (empty arrays and a clean exit if no match is found).
3. For every name in `openspec_changes`, the workflow installs the OpenSpec CLI pinned to `.openspec-version` and runs `openspec archive "<name>" --yes --json` non-interactively, skipping any change whose `openspec/changes/<name>/` directory is already gone (already archived).
4. For every ID in `feature_ids`, the workflow builds and `npm link`s `lv` from source, installs the Claude Code CLI, and runs `claude -p "..."` headlessly (authenticated via the `CLAUDE_CODE_OAUTH_TOKEN` secret from `claude setup-token`) to invoke the `lv-bootstrap` skill for that feature, refreshing `docs/features/<id>/{overview.md,design.md}`.
5. The workflow stages `openspec/` and `docs/`, commits under a `github-actions[bot]` identity only if something changed, and pushes directly to the default branch — retrying once with `git pull --rebase` on a push conflict.

## Constraints and Assumptions

- Tracing is controlled by a single boolean toggle, `tracing.enabled`, which defaults to `true`.
- The tracing path is local and storage-backed through LibSQL, not an external observability service.
- Observability applies to Mastra agent runs only (`lv start`'s feature-match/feature-split agents), not to git, Lark, or CLI timing.
- `registerAgent()` is designed to tolerate repeated registration of the same agent ID in one process by returning the already-registered agent.
- npm publishing is a manual, maintainer-run step; there is no CI/CD workflow that runs `npm publish` automatically, and none is planned as part of this feature's current scope.
- The published package is public and unscoped (`lv-engineer-crew` on the public npm registry), licensed MIT.
- The archive-on-merge workflow resolves a merged branch to a change by an exact string match against `state.yaml`'s `branch` field — it does not reuse `matchBranch()`/branch-pattern parsing, since the exact branch string is already recorded there.
- The workflow commits directly to the default branch with no required human review step, by explicit design decision — generated changes are meant to be audited after the fact via `git log`/`git show`, not gated before landing.
- The headless feature-doc refresh depends on a long-lived Claude Code subscription token (`CLAUDE_CODE_OAUTH_TOKEN`, from `claude setup-token`), not an `ANTHROPIC_API_KEY`; if that credential is missing/expired, the workflow fails visibly rather than silently skipping the doc refresh.
- The workflow's archive step is a raw `openspec archive` CLI call, not a headless `/opsx:archive` agent run, specifically to avoid that generated command's interactive confirmation prompts, which have no human present to answer in CI.
- The feature docs are auto-generated but are meant to be reviewed and edited before committing (or, for CI-generated commits, after the fact).

## Current State of the Code

Tracing: `src/mastra/index.ts` exports the shared Mastra instance with conditional observability and the `registerAgent()` helper, `src/types.ts` defines `tracing.enabled`, and `src/cli/start.ts`'s `featureMatchAgent`/`featureSplitAgent` register through that shared instance. There is no `src/agents/` directory anymore, and `src/cli/bootstrap.ts` does not construct or register any agent — `lv bootstrap`'s own docs generation is the `lv-bootstrap` skill/command running inside the calling coding agent's turn, not a Mastra `Agent` `lv` itself calls.

npm publishing: `package.json` carries `license: "MIT"`, a `repository` field (npm-normalized to the object form pointing at `github.com/dragonlong206/lv-engineering-crew`), `keywords`, `publishConfig.access: "public"`, `files: ["dist", "README.md", "LICENSE"]`, and `scripts.prepublishOnly: "npm run build"`. A root `LICENSE` file (MIT) exists. `README.md`'s "Get started" and "Installation" sections lead with `npm install -g lv-engineer-crew` for end users and keep the git-clone/build/`npm link` sequence as the contributor path. `docs/features/INDEX.md` already links to the `devops` feature.

CI archive-on-merge: `.github/workflows/archive-on-merge.yml` exists and defines a single `archive-and-sync` job gated on `github.event.pull_request.merged == true && github.event.pull_request.base.ref == github.event.repository.default_branch`. It checks out the default branch, runs `npm ci`, then `scripts/ci/resolve-merged-change.mjs` (plain Node + `js-yaml`, both already dependencies) to resolve the merged branch's linked change. It conditionally archives OpenSpec changes and refreshes feature docs based on whether the resolution script's outputs are non-empty arrays, then commits and pushes. The root `.openspec-version` file currently pins `1.12.0`. `README.md` documents this workflow under "CI: archive & doc sync on merge", including how to bump `.openspec-version` and how to generate/rotate the `CLAUDE_CODE_OAUTH_TOKEN` secret via `claude setup-token`. This capability is tracked as the `ci-archive-on-merge` OpenSpec capability, now archived into `openspec/specs/ci-archive-on-merge/spec.md`.
