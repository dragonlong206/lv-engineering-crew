## 1. Merged-change resolution script

- [x] 1.1 Add `scripts/ci/resolve-merged-change.mjs`: given a branch name (from `process.argv`/env), scan `docs/changes/*/state.yaml` with `js-yaml`, and find the entry whose `branch` field matches exactly. Verify by running it locally against the current branch's own `state.yaml` and confirming it prints the right change ID.
- [x] 1.2 Write `change-id`, `openspec-changes` (JSON array of `openspec_changes`), and `feature-ids` (JSON array of `feature_ids`) to `$GITHUB_OUTPUT` when run inside a workflow (fall back to stdout when `GITHUB_OUTPUT` is unset, for local testing). Verify by running locally with `GITHUB_OUTPUT` unset and with it pointed at a scratch file, checking both output shapes.
- [x] 1.3 Handle the no-match case (no `state.yaml` has that branch, or `openspec_changes` is empty) by exiting 0 with empty output arrays rather than erroring. Verify by running against a branch name that matches no `state.yaml`.

## 2. OpenSpec CLI version pin

- [x] 2.1 Add a root `.openspec-version` file containing the OpenSpec CLI version currently used locally (`openspec --version`). Verify the file contains a single valid semver line.

## 3. GitHub Actions workflow

- [x] 3.1 Add `.github/workflows/archive-on-merge.yml` triggered on `pull_request` `types: [closed]`, with a job-level `if: github.event.pull_request.merged == true && github.event.pull_request.base.ref == github.event.repository.default_branch`. Verify with `actionlint` (or GitHub's workflow syntax validation) that the file parses.
- [x] 3.2 Add a `permissions: contents: write` block and check out the merged default branch (`actions/checkout` with `ref: ${{ github.event.repository.default_branch }}`). Verify the checkout step targets the default branch, not the merge commit's detached ref.
- [x] 3.3 Add steps to set up Node (matching `engines.node` in `package.json`) and run `npm ci`. Verify the job installs cleanly against the committed `package-lock.json`.
- [x] 3.4 Add a step running `scripts/ci/resolve-merged-change.mjs` with `github.event.pull_request.head.ref`, capturing its `change-id`/`openspec-changes`/`feature-ids` outputs. Verify by inspecting the step's `$GITHUB_OUTPUT` contents on a test run against this change's own branch.
- [x] 3.5 Add a step (skipped when `openspec-changes` output is empty) that installs the OpenSpec CLI pinned via `.openspec-version` (`npm install -g @fission-ai/openspec@"$(cat .openspec-version)"`) and, for each name in `openspec-changes`, runs `openspec archive "<name>" --yes --json` only if `openspec/changes/<name>/` still exists (idempotency per design.md), else skips it. Verify locally by running the same `openspec archive --yes --json` invocation against a throwaway change and confirming it exits 0 without prompting.
- [x] 3.6 Add a step (skipped when `feature-ids` output is empty) that installs the Claude Code CLI and, authenticated via the `CLAUDE_CODE_OAUTH_TOKEN` secret, runs `claude -p` once per feature ID with a prompt invoking the `lv-bootstrap` skill for that feature, scoped with `--add-dir`/`--allowedTools` to the checked-out repo. Confirm the exact env var name Claude Code's CLI expects for a `claude setup-token` credential against current Claude Code docs before wiring the secret (design.md Open Question), and fail the step (non-zero exit) if authentication fails rather than swallowing the error. Verify by running the same `claude -p` invocation locally against a `CLAUDE_CODE_OAUTH_TOKEN` generated via `claude setup-token`.
- [x] 3.7 Add a commit/push step: `git add -A -- openspec/ docs/`, commit under a bot identity (`github-actions[bot]`) only if `git diff --cached --quiet` reports staged changes, then push; on push rejection, `git pull --rebase` once and retry, failing the job (not force-pushing) if it still fails. Verify by running the archive+refresh steps against a scratch change locally and confirming `git status` shows only the expected `openspec/`/`docs/` paths staged, with no commit created when nothing changed.

## 4. Documentation

- [x] 4.1 Add a new `README.md` section (near "Configuration"/"Commands") documenting: what triggers the workflow, that it commits directly to the default branch, and where `.openspec-version` lives. Verify by reading the rendered section for accuracy against the implemented workflow.
- [x] 4.2 Document, in that same section, how to pin/bump `.openspec-version` when upgrading the OpenSpec CLI locally (`openspec --version`, then update the file). Verify the steps match what `.openspec-version` (task 2.1) actually expects.
- [x] 4.3 Document how to generate a long-lived Claude Code token (`claude setup-token`), store it as the `CLAUDE_CODE_OAUTH_TOKEN` repo secret, and re-authenticate/rotate it once it expires (including how an expired-token failure will surface, per the visible-failure requirement). Verify the documented secret name matches what the workflow (task 3.6) actually reads.

## 5. End-to-end verification

- [ ] 5.1 Exercise the full flow on a real (throwaway) branch/PR in this repo: start a change with `lv start --description ...`, run `/opsx:propose`/`/opsx:apply` through tasks, open and merge a PR, and confirm the workflow archives the change, refreshes any touched feature's docs, and commits both directly to the default branch. Verify by inspecting the resulting commit and confirming `openspec/changes/<name>/` no longer exists post-merge.
- [ ] 5.2 Exercise the no-op path: merge a PR whose branch has no matching `docs/changes/<id>/state.yaml`, and confirm the workflow run succeeds with no commit created. Verify via the workflow run log and `git log` showing no new commit.
