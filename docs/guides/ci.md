# CI workflows

## Archive & doc sync on merge

`.github/workflows/archive-on-merge.yml` runs whenever a PR is merged into the repo's default branch. It:

1. Resolves the merged branch to its `docs/changes/<change-id>/state.yaml`, via `scripts/ci/resolve-merged-change.mjs` (no match → the run exits cleanly and makes no changes).
2. Archives and syncs every OpenSpec change listed in that state's `openspec_changes`, non-interactively (`openspec archive --yes --json`) — already-archived changes are skipped.
3. Refreshes `docs/features/<id>/{overview.md,design.md}` for every feature ID in `feature_ids`, by running the `lv-bootstrap` skill headlessly through the Claude Code CLI (`claude -p`).
4. Commits the result **directly to the default branch** (no PR, no required review) — a bot commit under `github-actions[bot]`, or nothing at all if there was nothing to sync.

This is fully automated by design; review generated changes after the fact via `git log`/`git show` rather than before they land.

**Using it in your own repo** — `lv init` does not install this workflow for you yet. Copy `.github/workflows/archive-on-merge.yml` and `scripts/ci/resolve-merged-change.mjs` from this repository into your repo, and replace the "Build lv and expose it on PATH" step (which builds `lv` from this repo's source) with `npm install -g lv-engineer-crew`.

**Pinning the OpenSpec CLI version** — the workflow installs the OpenSpec CLI pinned to whatever version is in the root `.openspec-version` file (a single line, e.g. `1.12.0`), instead of `latest`, so CI's archive/sync behaves the same as your local `openspec archive`/`/opsx:archive` runs. Whenever you intentionally upgrade your local OpenSpec CLI, check the new version (`openspec --version`) and bump `.openspec-version` to match in the same PR.

**Setting up the Claude Code credential** — the doc-refresh step authenticates as a Claude subscription (Pro/Max/Team/Enterprise), not an API key:

```bash
claude setup-token   # generates a long-lived OAuth token from your Claude subscription
```

Store the printed token as the `CLAUDE_CODE_OAUTH_TOKEN` repo secret (Settings → Secrets and variables → Actions). If the token expires or is revoked, the workflow's doc-refresh step fails visibly (rather than silently skipping the feature-doc refresh) — re-run `claude setup-token` and update the secret to re-authenticate.

## Publish to npm on release

`.github/workflows/release-npm.yml` runs whenever a GitHub Release is published. It:

1. Checks out the exact commit the release tag points at.
2. Installs dependencies (`npm ci`) and verifies the release tag matches `package.json`'s `version` field, failing before any build/publish step if they differ.
3. Type-checks (`npx tsc --noEmit`) and builds (`npm run build`) — the same verification this repo's `CLAUDE.md` prescribes for a human doing this manually.
4. Publishes to the public npm registry (`npm publish`).

**Cutting a release** — as a maintainer:

```bash
npm version patch   # or minor / major — bumps package.json and creates a git tag
git push --follow-tags
```

Then publish a GitHub Release for that tag (via the GitHub UI, or `gh release create`). Publishing the Release is what triggers the workflow — pushing the tag alone does not.

**Authentication — npm Trusted Publishing (OIDC), no token or secret required.** The workflow authenticates via [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers), not a stored `NPM_TOKEN`: npm is removing the "bypass 2FA" option on classic Automation tokens that a non-interactive CI publish would otherwise need, and Trusted Publishing is npm's replacement — GitHub Actions exchanges a short-lived, workflow-scoped OIDC identity for registry access at publish time, with nothing long-lived to store or rotate.

**Prerequisite — the package must exist on the registry first.** npm's Trusted Publisher UI is configured from the package's own settings page, which only exists once the package has been published at least once. `lv-engineer-crew` has not been published yet, so before this workflow can succeed:

1. A maintainer publishes the first version manually, authenticated with their own npm login/2FA: `npm publish` from a clean checkout (`prepublishOnly` builds `dist/` first automatically).
2. Only after that first publish does step "One-time setup on npmjs.com" below become possible.

Every release after that first manual one goes through the CI workflow.

One-time setup on npmjs.com, as a maintainer with publish access to `lv-engineer-crew` (only possible once the package exists — see Prerequisite above):

1. Go to the package's page → **Settings** → **Publishing access**.
2. Add a **GitHub Actions** trusted publisher with:
   - Organization or user: this repo's owner
   - Repository: this repo's name
   - Workflow filename: `release-npm.yml`
3. No GitHub repository secret needs to be created — the workflow already declares the `id-token: write` permission Trusted Publishing needs.

If the Trusted Publisher entry is missing, or its repo/workflow values don't match, the `npm publish` step fails visibly with an authentication error rather than silently skipping the publish. This includes the case where the package doesn't exist on the registry at all yet (see Prerequisite above) — `npm publish` in CI cannot create a brand-new package under Trusted Publishing; only a human's authenticated `npm publish` can.
