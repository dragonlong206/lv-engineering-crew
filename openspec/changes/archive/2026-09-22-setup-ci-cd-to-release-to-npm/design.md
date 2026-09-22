## Context

See `proposal.md` - Why/What Changes for motivation. Relevant existing state:

- `package.json` already carries publish-ready metadata (`license`, `repository`, `keywords`, `publishConfig.access: "public"`, `files`, `prepublishOnly: npm run build`) from `openspec/specs/npm-package-publishing/spec.md` — this change adds *when/how* publish runs, not *what* gets published.
- `.github/workflows/archive-on-merge.yml` is the only existing workflow in this repo and sets the house style this design follows: `actions/checkout@v4`, `actions/setup-node@v4` pinned to `node-version: "20"` (matching `package.json`'s `engines.node`), `npm ci` for install, secrets passed via step `env:`, and `set -euo pipefail` in multi-line `run:` blocks.
- `CLAUDE.md` prescribes `npx tsc --noEmit` and `npm run build` as this repo's standard verification (there is no test suite), so CI should run the same checks a human is told to run.
- There is no npm registry secret configured in this repo yet (`grep`ping for `NPM_TOKEN`/`NODE_AUTH_TOKEN` across workflows/docs found nothing).
- npm is deprecating the "bypass 2FA" option on classic Automation tokens — the long-lived-token pattern this design originally used (mirroring `archive-on-merge.yml`'s `CLAUDE_CODE_OAUTH_TOKEN` secret). A CI publish flow can no longer rely on that bypass, so the design below uses npm's [Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) instead: GitHub Actions exchanges a short-lived, workflow-scoped OIDC token for registry access, with no npm token stored anywhere. This requires npm CLI ≥ 11.5.1; the GitHub-hosted runner's bundled npm for `node-version: "20"` is older, so the workflow must upgrade npm before publishing.

## Goals / Non-Goals

**Goals:**
- Publish `lv-engineer-crew` to npm automatically when a maintainer publishes a GitHub Release, with the same verification a manual publish is supposed to get.
- Fail loudly (no publish) on a version mismatch, a verification failure, or a missing/invalid credential — never publish silently-wrong output.
- Keep the manual `npm publish` path (and `prepublishOnly`) working unchanged as a fallback.

**Non-Goals:**
- Automated version bumping, changelog generation, or conventional-commit enforcement (rejected option — see the proposal's "What Changes" note; this stays a manual `npm version` + GitHub Release step).
- Configuring the npm-side Trusted Publisher entry itself — that's a manual, one-time maintainer action in the package's npmjs.com settings (documented in the README, per the proposal), not something workflow code can do.
- Any fallback to token-based publishing — since no `NPM_TOKEN` secret exists in this repo yet (see Context), there is no legacy credential to keep supporting side-by-side; Trusted Publishing is the only publish path this change implements.

## Decisions

**Trigger: `release: { types: [published] }`, not `push: { tags: 'v*' }`.**
Chosen (per user decision during proposal) over a raw tag-push trigger so releases go through GitHub's Release UI/`gh release create` — giving each publish a human-readable changelog entry and a single object (the Release) that both triggers CI and documents the release, rather than a bare tag. Alternative considered: `push: tags: ['v*']` — simpler trigger, but loses the Release-notes artifact and doesn't distinguish a draft from a published release (drafts don't fire `push`, but the distinction is implicit rather than explicit in the trigger).

**Version-match gate: compare the release tag to `package.json` before publishing.**
The workflow strips a leading `v` from `github.event.release.tag_name` and compares it to `node -p "require('./package.json').version"`; a mismatch fails the job before `npm ci`'s build steps run `npm publish`. This directly implements the "Release tag version must match package version" requirement in `specs/ci-release-npm/spec.md` and catches the most likely human error in a manual-versioning flow: cutting a release for the wrong commit or forgetting to bump `package.json`.

**Verification steps: `npm ci` → `npx tsc --noEmit` → `npm run build` → version check → `npm publish`.**
Mirrors `CLAUDE.md`'s prescribed verification exactly, run against the exact commit the Release points at (via `actions/checkout@v4` with the default ref, which for a `release` event checks out the tag). `npm run build`'s own `tsup` run regenerates `dist/` fresh in the CI workspace, so `prepublishOnly` running `npm run build` again during `npm publish` is a fast no-op safety net, not redundant work — consistent with `npm-package-publishing`'s existing "a build always precedes publish" requirement.

**Auth: npm Trusted Publishing (OIDC) — no stored secret at all.**
Chosen over a `NPM_TOKEN` repository secret (the originally-designed approach) because npm is removing the "bypass 2FA" option on classic Automation tokens, which a non-interactive CI publish depends on. Trusted Publishing is npm's purpose-built replacement (same model as PyPI's): the workflow declares `permissions: id-token: write`, and `npm publish` (CLI ≥ 11.5.1) automatically detects the GitHub Actions OIDC context, exchanges a short-lived token bound to this exact repo + workflow file for a one-time registry credential, and publishes — with build provenance attached automatically, no extra `--provenance` flag or `.npmrc` authoring needed. This requires a one-time maintainer step on npmjs.com: adding a Trusted Publisher entry on the `lv-engineer-crew` package pointing at this GitHub repo and `.github/workflows/release-npm.yml` (documented in the README). Because the runner's bundled npm (from `node-version: "20"`) predates 11.5.1, the workflow must run `npm install -g npm@latest` (or pin a version ≥ 11.5.1) before the publish step. Alternative considered: a npm Granular Access Token with 2FA-bypass disabled — rejected because it's still a long-lived stored secret requiring manual rotation and repo-secret provisioning, exactly the maintenance burden Trusted Publishing exists to remove, and npm's own guidance now steers new automation toward Trusted Publishing.

**Permissions: `contents: read` + `id-token: write` (no `contents: write` needed).**
Unlike `archive-on-merge.yml` (which commits back to the repo), this workflow only reads the checked-out commit and calls the npm registry — it never pushes to git, so no elevated `contents` permission is needed. `id-token: write` is required for the OIDC token exchange Trusted Publishing depends on.

## Risks / Trade-offs

- **Trusted Publisher entry is missing, or points at the wrong repo/workflow filename** → `npm publish` fails visibly with an authentication error (per the spec's "fails visibly" requirement), since npm's registry has nothing to exchange the OIDC token against; mitigation is the README documenting the exact repo/workflow values to enter on npmjs.com, and keeping the workflow filename (`release-npm.yml`) stable once configured (renaming it later requires updating the Trusted Publisher entry too).
- **Runner's bundled npm predates OIDC support (< 11.5.1)** → the explicit `npm install -g npm@latest` step (see Decisions) mitigates this; if omitted, `npm publish` would fail with an auth error even though Trusted Publishing is correctly configured on npm's side, which is the main reason this upgrade step is called out explicitly in tasks.md rather than left implicit.
- **A maintainer publishes a GitHub Release without having bumped `package.json`** → caught by the version-match gate before any publish attempt; mitigation is the gate itself plus the README documenting the required order (`npm version` → push tag → publish Release).
- **A maintainer re-publishes/edits an already-published Release** → GitHub only fires `release: published` on the transition into "published" (not on later edits), so this cannot trigger a duplicate publish; a genuine duplicate-version publish attempt would instead fail naturally at `npm publish` (npm rejects re-publishing an existing version), which is an acceptable, visible failure rather than a silent no-op.
- **No test suite to gate on** (per `CLAUDE.md`) → the pipeline's verification is limited to type-checking and a successful build; this is the same verification bar the repo already holds humans to, not a regression introduced by this change.

## Migration Plan

No existing behavior is removed or migrated — this is an additive workflow. Rollout is: merge this change, a maintainer adds a Trusted Publisher entry for `lv-engineer-crew` on npmjs.com pointing at this repo and `.github/workflows/release-npm.yml` (documented in the updated README — no GitHub repository secret to create), and the next GitHub Release published exercises the pipeline for the first time. If the workflow needs to be paused, disabling it in the GitHub Actions UI (or reverting the workflow file) leaves the manual `npm publish` path fully functional as a fallback (a maintainer publishing locally still authenticates via their own npm login/2FA, unaffected by this change).
