## 1. package.json metadata

- [x] 1.1 Add `license: "MIT"`, `repository: "github:dragonlong206/lv-engineering-crew"`, and a `keywords` array to `package.json`; verify by inspecting the file and confirming `npm pkg get license repository keywords` returns the expected values
- [x] 1.2 Add `publishConfig: { "access": "public" }` to `package.json`; verify with `npm pkg get publishConfig`
- [x] 1.3 Add `files: ["dist", "README.md", "LICENSE"]` to `package.json`; verify with `npm pkg get files`
- [x] 1.4 Add a `prepublishOnly` script running `npm run build`; verify with `npm pkg get scripts.prepublishOnly`

## 2. License file

- [x] 2.1 Add a root `LICENSE` file with the standard MIT license text (copyright holder: the repo's git user); verify the file exists and its `SPDX-License-Identifier` text matches `MIT`

## 3. Verify the publish tarball

- [x] 3.1 Run `npm run build` then `npm pack --dry-run` and confirm the file list includes `dist/index.js`, `dist/index.d.ts`, and the `dist/*.js` chunk files `dist/index.js` imports (per `specs/npm-package-publishing/spec.md` - "Published tarball includes the built CLI")
- [x] 3.2 Delete `dist/` and run `npm publish --dry-run` again (relying on `prepublishOnly` — `npm pack` does NOT run `prepublishOnly`, only `npm publish` does; corrected from the original task wording, which named the wrong command) to confirm the tarball still contains a fresh `dist/` (per spec - "A build always precedes publish"); rebuild afterward with `npm run build` to restore the local `dist/`. This dry-run also surfaced two `npm warn publish` manifest-normalization notices (bin path's leading `./` stripped, `repository` shorthand expanded to object form) — non-breaking, but fixed via `npm pkg fix` so a real `npm publish` runs warning-free

## 4. README

- [x] 4.1 Update the "Get started" section to lead with `npm install -g lv-engineer-crew` as the primary install command for end users, ahead of the ticket/config setup steps that follow it today. Also fixed the credentials step in this section, which previously referenced `cp /path/to/lv-engineer-crew-repo/.lv.local.yaml.sample .lv.local.yaml` — a path that only exists for a git clone and would be unreachable/misleading for an npm-installed user (`.lv.local.yaml.sample` isn't shipped in the published package's `files`); replaced with a pointer to the Configuration section instead
- [x] 4.2 Update the "Installation" section to present the npm install as the default path, and reframe the existing `git clone` / `npm install` / `npm run build` / `npm link` sequence as the path for contributors building `lv` from source
- [x] 4.3 Re-read both updated sections end-to-end and confirm a first-time reader can tell, without ambiguity, which steps are "just install and use it" versus "I'm working on `lv` itself" (per spec - "README documents installing the published package")
