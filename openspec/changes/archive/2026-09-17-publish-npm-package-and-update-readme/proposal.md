## Why

`lv` is currently only installable by cloning the repo and running `npm link`, which is the wrong onboarding path for anyone outside the repo's own contributors. The unscoped name `lv-engineer-crew` is available on the public npm registry, so the package can be published there and installed with a single `npm install -g lv-engineer-crew` — but `package.json` is not yet publish-ready (no `license`, no `repository`, no `files` whitelist) and, more importantly, `dist/` is `.gitignore`d, which npm's default file-inclusion rule falls back to for tarball packing in the absence of a `files` field or `.npmignore` — so a plain `npm publish` today would ship a tarball with **no `dist/`**, and the installed `lv` binary would fail immediately. The README also still only documents the clone-and-`npm-link` path.

## What Changes

- Add npm-publish metadata to `package.json`: `license` (`MIT`), `repository` (pointing at `github:dragonlong206/lv-engineering-crew`, matching the existing `origin` remote), `keywords`, `publishConfig.access: "public"` (harmless but explicit for an unscoped public package), and a `files` field whitelisting `dist` (and `README.md`/`LICENSE`, which npm includes by default but are safe to list) so the published tarball reliably contains the build output regardless of `.gitignore`.
- Add a `prepublishOnly` script (`npm run build`) so `npm publish` always ships a freshly built `dist/`, even if the author forgot to build first.
- Add a root `LICENSE` file (MIT, matching the new `package.json` `license` field).
- Update `README.md`'s "Get started" and "Installation" sections to lead with `npm install -g lv-engineer-crew` as the primary install path for end users, while keeping the existing clone/`npm link` instructions as the path for contributors working on `lv` itself.
- No source/runtime behavior of any `lv` command changes — this is packaging metadata and documentation only.

## Capabilities

### New Capabilities
- `npm-package-publishing`: `package.json` carries the metadata and file-inclusion rules needed to publish `lv-engineer-crew` to the public npm registry with a working `dist/`, and the README documents installing the published package via npm alongside the existing source-build path for contributors.

### Modified Capabilities
(none — no existing capability's requirements change)

## Impact

- `package.json`: new `license`, `repository`, `keywords`, `publishConfig`, `files` fields; new `prepublishOnly` script.
- New root `LICENSE` file (MIT).
- `README.md`: "Get started" and "Installation" sections gain an npm-install path; existing clone/build/`npm link` instructions are kept, reframed as the contributor path.
- No changes to `src/`, `dist/` build tooling (`tsup`), CLI behavior, or any `lv` subcommand.
- Out of scope: automated CI/CD publishing (e.g. a GitHub Actions workflow that runs `npm publish` on tag/release) and npm 2FA/token setup — those are operational follow-ups the maintainer handles outside this change; this change only makes a manual `npm publish` from a maintainer's machine correct.
