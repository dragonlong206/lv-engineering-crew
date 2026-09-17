## Context

See `proposal.md` - Why. `package.json` today has no `license`, `repository`, or `files` field, and `dist/` is `.gitignore`d. `npm pack`/`npm publish` fall back to `.gitignore` for file-inclusion rules only when no `files` field and no `.npmignore` exist — that fallback is what would currently ship a `dist`-less, broken tarball. `origin` is `git@github-personal:dragonlong206/lv-engineering-crew.git`; `npm view lv-engineer-crew` confirms the unscoped name is unclaimed on the public registry, and `.lv.yaml` sets `output_language: English`.

## Goals / Non-Goals

**Goals:**
- Make `npm publish` (run manually by the maintainer) produce a working global install of `lv` from the public npm registry.
- Give end users a one-command install path in the README without removing the contributor build path.

**Non-Goals:**
- No CI/CD workflow that runs `npm publish` automatically — publishing stays a manual, maintainer-run step (see proposal.md - Impact, "Out of scope").
- No npm 2FA/token/CI-secret setup.
- No change to `tsup`'s build output shape, the CLI's runtime behavior, or any `lv` subcommand.

## Decisions

**Use a `files` whitelist, not `.npmignore`.** A `files: ["dist", "README.md", "LICENSE"]` field in `package.json` is the modern, colocated way to control publish inclusion and is easier to keep in sync with the build than a separate `.npmignore` file that could silently drift. `README.md`/`LICENSE` are included by npm by default even without listing them, but listing them makes the intent explicit and keeps the whitelist self-documenting. `src/` is deliberately left off the list — consumers only need the built `dist/`, matching the existing `bin` entry (`./dist/index.js`).

**Add a `prepublishOnly` script (`npm run build`) rather than relying on the maintainer to remember to build.** `prepublishOnly` runs before both `npm pack` and `npm publish`, so a stale or absent `dist/` can never be published by accident. Alternative considered: a `prepare` script (also runs on `npm install`) — rejected because it would force a build on every `npm install` inside this repo (including CI/dev installs that don't need one), not just on publish.

**`repository` field uses the `github:` shorthand pointing at the existing `origin` remote** (`github:dragonlong206/lv-engineering-crew`), so npm's package page links back to the actual source repo without introducing a second, divergent URL to maintain.

**License: MIT**, per explicit user decision (this workflow's clarifying question) — chosen over `UNLICENSED` since the package is being published to the public registry specifically so outside users can install it, which implies granting them a real license to use it.

**Registry: public npmjs.org**, per explicit user decision — chosen over GitHub Packages (which would require a GitHub token even to install a public package) and a private registry (not applicable — there is no existing private registry for this project).

**README keeps both install paths rather than replacing clone/`npm link` with npm-only instructions.** Contributors working on `lv` itself still need the source build; only end users installing the tool need the npm path. The README already separates "Get started" (quick path) from "Installation" (detail) — the npm command becomes the lead quick-start step, with the existing clone/build sequence reframed as "for contributors" rather than removed.

## Risks / Trade-offs

- **[Risk] `npm publish` is still a manual step, so it can be forgotten or run from a stale checkout.** → Mitigated by `prepublishOnly` forcing a fresh build; further automation (CI publish-on-tag) is explicitly out of scope for this change and can be a follow-up.
- **[Risk] Publishing an unscoped public package name is irreversible if claimed by someone else later, and `lv` is a very short/generic binary name that could collide with another global CLI a user has installed.** → Out of this change's control once published; noted here for the maintainer's awareness before running `npm publish` for the first time, not something the code can mitigate.
- **[Trade-off] Listing `README.md`/`LICENSE` explicitly in `files` is redundant with npm's default-include behavior.** → Accepted for clarity/self-documentation over minimalism; no functional downside.
