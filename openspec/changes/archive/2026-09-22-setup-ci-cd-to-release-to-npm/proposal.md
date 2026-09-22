## Why

`lv-engineer-crew` is published to npm by a maintainer running `npm publish` locally (see `openspec/specs/npm-package-publishing/spec.md` and `docs/features/devops/overview.md`, which explicitly notes "there is no CI/CD workflow that runs `npm publish` automatically"). That manual step is easy to forget, easy to get wrong (stale local `dist/`, wrong `npm whoami`, forgotten `npm run build`), and gives no audit trail of what triggered a given release. This change adds a CI/CD pipeline so publishing to npm happens automatically and consistently from a GitHub Release, following the repo's existing pattern of `.github/workflows/archive-on-merge.yml` for automated CI — though authenticating via npm Trusted Publishing (OIDC) rather than a stored secret, since npm is removing 2FA-bypass on the classic token type a stored-secret approach would otherwise need.

## What Changes

- Add a new GitHub Actions workflow, `.github/workflows/release-npm.yml`, triggered on `release: { types: [published] }`.
- The workflow checks out the released tag, installs dependencies (`npm ci`), type-checks (`npx tsc --noEmit`) and builds (`npm run build`) — the same verification steps `CLAUDE.md` already prescribes for this repo — then verifies the release tag's version matches `package.json`'s `version` field before publishing, failing fast on a mismatch instead of publishing the wrong version.
- The workflow authenticates to npm via [Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) — no npm token or GitHub repository secret at all. This is required, not just preferred: npm is removing the "bypass 2FA" option on classic Automation tokens that a non-interactive CI publish would otherwise depend on, and Trusted Publishing is npm's replacement for that use case.
- Document the release process in `README.md` (a new "CI: publish to npm on release" section, alongside the existing "CI: archive & doc sync on merge" section): how a maintainer cuts a release (`npm version <patch|minor|major>`, push the tag, publish a GitHub Release) and how to configure the one-time Trusted Publisher entry for `lv-engineer-crew` on npmjs.com.
- Versioning and release-note authorship stay manual (`npm version` + the GitHub Release UI/`gh release create`) — this change does not introduce automated semantic versioning, changelog generation, or conventional-commit enforcement.

## Capabilities

### New Capabilities
- `ci-release-npm`: a GitHub Actions workflow that publishes `lv-engineer-crew` to the public npm registry when a GitHub Release is published, gated on the release tag matching `package.json`'s version, authenticated via npm Trusted Publishing (OIDC) with no stored token.

### Modified Capabilities
(none — `npm-package-publishing`'s existing requirements, which cover tarball contents, `package.json` metadata, and the `prepublishOnly` build, are unchanged and still hold for both the manual and CI-driven publish path)

## Impact

- **New file**: `.github/workflows/release-npm.yml`.
- **`README.md`**: new documentation section for the release/publish workflow and the Trusted Publisher setup on npmjs.com.
- **`docs/features/devops/{overview.md,design.md}`**: will need refreshing after this change lands (via `lv bootstrap devops`) since the current text states no CI/CD publish workflow exists.
- **npm package settings**: requires a maintainer to add a Trusted Publisher entry (GitHub repo + `.github/workflows/release-npm.yml`) for `lv-engineer-crew` on npmjs.com — not something this change's code can provision itself, and not a GitHub repository secret; documented as a manual setup step.
- **No changes** to `package.json`'s publish metadata, `prepublishOnly` script, or the manual `npm publish` path — both remain valid (a maintainer publishing locally still authenticates via their own npm login/2FA).
