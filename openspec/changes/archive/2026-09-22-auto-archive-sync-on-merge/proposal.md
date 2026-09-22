## Why

Today, syncing merged work back into `openspec/specs/` and refreshing `docs/features/` is a manual step: an engineer must remember to run `/opsx:archive` (or `openspec archive`) and re-invoke the `lv-bootstrap` skill per touched feature after their PR lands. When that's skipped, main specs and feature docs silently drift out of sync with the code that actually merged. Automating this on PR merge removes the reliance on manual discipline.

## What Changes

- Add a GitHub Actions workflow that runs when a PR is merged into the default branch. It:
  - Resolves the merged PR's source branch to its `docs/changes/<change-id>/state.yaml` and reads the OpenSpec change name(s) recorded in `openspec_changes` and the feature IDs in `feature_ids`.
  - Installs the OpenSpec CLI pinned to the same version used locally, then runs `openspec archive <change> --yes --json` non-interactively for each linked change — syncing delta specs into main specs, skipping OpenSpec's interactive confirmation prompts.
  - Runs the Claude Code CLI headlessly (`claude -p`), authenticated via a long-lived Claude subscription token (`claude setup-token`) stored as a repo secret, to invoke the `lv-bootstrap` skill for each feature ID in `feature_ids` — refreshing `docs/features/<id>/{overview.md,design.md}` per `ARCHIVE_GUIDANCE`'s existing convention.
  - Commits the archived OpenSpec state and refreshed feature docs directly to the default branch and pushes.
- Document the setup in `README.md`:
  - How to pin the CI runner's OpenSpec CLI install to the same version used locally (e.g. `openspec --version`), so an unpinned runner doesn't archive/sync against a different schema or CLI behavior than what engineers use day to day.
  - How to generate a Claude Code long-lived subscription token via `claude setup-token`, store it as the `CLAUDE_CODE_OAUTH_TOKEN` repo secret, and re-authenticate (regenerate and rotate the secret) once it expires.

This is CI/tooling scope only — no change to any `lv` CLI command's behavior or `src/` runtime code.

## Capabilities

### New Capabilities
- `ci-archive-on-merge`: on PR merge, resolve the merged branch's linked OpenSpec change(s) and feature IDs from `state.yaml`, archive/sync those changes non-interactively, refresh their feature docs via a headlessly-run `lv-bootstrap` skill, and commit the result to the default branch.

### Modified Capabilities
(none — no existing capability's requirements change)

## Impact

- New `.github/workflows/` file (exact name decided in design.md) — first CI workflow in this repo.
- Possibly a small helper script committed alongside the workflow to resolve a merged branch to its `state.yaml`/change/feature IDs (decided in design.md).
- New required repo secret: `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`), used to authenticate the headless Claude Code CLI run.
- Workflow needs `contents: write` permission (and a bot git identity) to push commits directly to the default branch.
- `README.md`: new documentation section covering OpenSpec version pinning in CI and the Claude Code token setup/rotation.
- No changes to `package.json` dependencies, `src/`, or any `lv` subcommand's behavior.
