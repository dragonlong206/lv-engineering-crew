## 1. Release workflow

- [x] 1.1 Create `.github/workflows/release-npm.yml` triggered on `release: { types: [published] }`, with `actions/checkout@v4` and `actions/setup-node@v4` (`node-version: "20"`, `registry-url: "https://registry.npmjs.org"`), matching the style of `.github/workflows/archive-on-merge.yml`; verify with `actionlint .github/workflows/release-npm.yml` (or `yamllint`/a YAML parse) reporting no syntax errors
- [x] 1.2 Add an `npm ci` step and verify it runs green when the workflow is exercised via `act` locally or a test Release on a scratch/fork repo
- [x] 1.3 Add a version-match step that compares `github.event.release.tag_name` (stripped of a leading `v`) against `node -p "require('./package.json').version"`, failing the job on mismatch; verify by asserting the step's shell logic locally: run the same comparison with `TAG=v9.9.9` against the current `package.json` version and confirm it exits non-zero
- [x] 1.4 Add `npx tsc --noEmit` and `npm run build` steps after the version-match step; verify both commands succeed locally (`npx tsc --noEmit`, `npm run build`) against the current `main`
- [x] 1.5 Set `permissions: { contents: read, id-token: write }` on the job (no `contents: write`, since this workflow never pushes to git); verify by inspecting the workflow file for exactly these two permissions
- [x] 1.6 Add an `npm install -g npm@latest` step before publish (the `node-version: "20"` runner's bundled npm predates the 11.5.1 minimum for OIDC Trusted Publishing); verify with `npm --version` printing ≥ 11.5.1 immediately after the step
- [x] 1.7 Add the `npm publish` step with no token/secret in its `env:` (authentication is via OIDC Trusted Publishing); verify by inspecting the step definition for the absence of any `NODE_AUTH_TOKEN`/`NPM_TOKEN`/`secrets.*` reference

## 2. Documentation

- [x] 2.1 Add a "CI: publish to npm on release" section to `README.md` (alongside the existing "CI: archive & doc sync on merge" section) documenting the release steps a maintainer follows (`npm version <patch|minor|major>`, push the tag, publish a GitHub Release) and the one-time Trusted Publisher setup on npmjs.com (package Settings → Publishing access → add a GitHub Actions trusted publisher naming this repo and `.github/workflows/release-npm.yml`, no repository secret to create); verify by reading the rendered section for accuracy against the actual workflow file

## 3. Verification

- [x] 3.1 Run `npx tsc --noEmit` and `npm run build` at the repo root and confirm both succeed, matching what the new workflow itself runs
- [x] 3.2 Run `openspec validate setup-ci-cd-to-release-to-npm --strict` (or the equivalent for this change) and confirm it passes with no errors
