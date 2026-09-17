## Purpose

Makes `lv-engineer-crew` installable from the public npm registry with a working `lv` binary, and documents that install path for end users alongside the existing source-build path for contributors.

## ADDED Requirements

### Requirement: Published tarball includes the built CLI
The npm publish tarball for `lv-engineer-crew` SHALL include the built `dist/` output (`dist/index.js`, `dist/index.d.ts`, and all `dist/*.js` chunk files `dist/index.js` imports) regardless of `dist/` being excluded from git via `.gitignore`.

#### Scenario: Packing the tarball without building first
- **WHEN** `npm pack --dry-run` (or `npm publish --dry-run`) is run from a clean checkout after `npm install` and `npm run build`
- **THEN** the listed tarball contents include every file under `dist/` needed to run the `lv` binary (`dist/index.js` and its chunk dependencies)

#### Scenario: dist/ stays out of version control
- **WHEN** `git status` is run after building
- **THEN** `dist/` remains untracked and ignored, and packing the tarball still includes it (tarball inclusion is independent of git tracking)

### Requirement: package.json declares npm publish metadata
`package.json` SHALL declare the metadata npm expects for a public package release: `license`, `repository`, `keywords`, and `publishConfig.access` set to `"public"`.

#### Scenario: Inspecting package metadata before publish
- **WHEN** `package.json` is read
- **THEN** it has a non-empty `license` field, a `repository` field pointing at the project's GitHub remote, a non-empty `keywords` array, and `publishConfig.access` set to `"public"`

### Requirement: A build always precedes publish
Running `npm publish` SHALL always build `dist/` fresh first, so a stale or missing local build cannot be published.

#### Scenario: Publishing without a prior manual build
- **WHEN** `npm publish` (or `npm publish --dry-run`) is run in a checkout where `dist/` does not yet exist or is stale
- **THEN** the `prepublishOnly` script runs `npm run build` before the package is packed, so the packed tarball reflects the current source

### Requirement: README documents installing the published package
The project README SHALL document installing `lv` via `npm install -g lv-engineer-crew` as the install path for end users, in addition to the existing clone/build/`npm link` path for contributors working on `lv` itself.

#### Scenario: A user wants to install lv without cloning the repo
- **WHEN** a reader follows the README's "Get started" or "Installation" section as an end user (not a contributor)
- **THEN** the documented steps install `lv` globally via `npm install -g lv-engineer-crew` and do not require cloning the repository or running `npm link`

#### Scenario: A contributor wants to build lv from source
- **WHEN** a reader follows the README's instructions for working on `lv` itself
- **THEN** the documented steps still cover `git clone`, `npm install`, `npm run build`, and `npm link`
