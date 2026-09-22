## Context

See `proposal.md` - Why. This repo has no `.github/workflows/` yet — this is the first CI workflow. `openspec archive` (see `openspec archive --help`) already supports non-interactive use via `--yes --json`. Feature-doc refresh has no non-interactive path today: `lv bootstrap <feature-id>` without `--new-feature`/`--context`/`--finalize` errors and points at the `lv-bootstrap` skill, which is designed to run inside a coding agent's own turn (see `ARCHIVE_GUIDANCE` in `src/prompts.ts` and `openspec/config.yaml`'s `operations.archive.guidance`). The user has decided this gap is closed by running the Claude Code CLI headlessly in the runner, authenticated with a long-lived subscription token (`claude setup-token`), not an `ANTHROPIC_API_KEY`. `docs/changes/<change-id>/state.yaml`'s `branch` field holds the literal branch name, and `openspec_changes`/`feature_ids` are already populated by `lv start`/`lv link` — no new `lv` parsing logic is needed to resolve a merged PR back to its change.

## Goals / Non-Goals

**Goals:**
- Archive every OpenSpec change linked to a merged PR's branch, non-interactively, syncing its delta specs into `openspec/specs/`.
- Refresh `docs/features/<id>/{overview.md,design.md}` for every feature ID the merged change touched, using the existing `lv-bootstrap` skill content, run headlessly.
- Keep the CI runner's OpenSpec CLI version explicitly pinned and easy to keep in sync with what engineers run locally.
- Land the results directly on the default branch with no required human review step (per user decision).

**Non-Goals:**
- No new `lv` CLI subcommand and no changes to `src/` runtime behavior — resolution logic lives in a small standalone CI script.
- No support for OpenSpec stores (`--store`) — this repo uses a plain local `openspec/` root, same as it does today.
- No review-PR path — direct commit to the default branch was chosen over opening a follow-up PR.
- No handling of `skip_specs`/`--skip-specs` beyond what `openspec archive` already does by default.

## Decisions

**Trigger: `pull_request` `closed`, guarded by `merged == true`.**
Use `on: pull_request: types: [closed]` with a job-level `if: github.event.pull_request.merged == true`, filtered to PRs whose base is the repo's default branch. This event payload directly exposes `github.event.pull_request.head.ref` (the merged branch name) with no extra API call.
*Alternative considered:* trigger on `push` to the default branch. Rejected — a merge's push event doesn't cleanly carry the originating branch name (would need `git log` parsing of the merge commit), and it would also fire on direct pushes to the default branch that aren't PR merges at all.

**Archive mechanism: raw `openspec archive --yes --json` CLI, not a headless `/opsx:archive` run.**
Even though the runner already has the Claude Code CLI installed for the feature-doc refresh step, the archive+sync step shells out directly to `openspec archive "<name>" --yes --json` rather than routing it through a headless `claude -p "/opsx:archive <name>"` call.
*Alternative considered:* running `/opsx:archive` (`.claude/commands/opsx/archive.md`) headlessly instead. Rejected — inspecting that generated command shows it doesn't call `openspec archive` CLI at all: it reimplements the archive as agent-driven steps (status/task-completion checks, an inline "agent-driven intelligent merge" via `/opsx:sync` for delta specs, then a raw `mkdir -p`/`mv` to move the change into `archive/`), and several of those steps are written to *prompt the user for confirmation* (e.g. "incomplete tasks found → prompt for confirmation to continue"; the sync prompt offers "Sync now" / "Archive without syncing" / "Cancel"). With no human present in headless `-p` mode, the agent would have to resolve those prompts itself, which is non-deterministic across runs — a real problem for an unattended CI job whose whole point is predictable, auditable behavior. It would also need broader Claude Code tool permissions (`Bash(mkdir:*)`, `Bash(mv:*)`, `Bash(git:*)`, ...) instead of the narrow scope (`--add-dir`/`--allowedTools` limited to reading source and writing `docs/features/<id>/*`) the lv-bootstrap-only invocation needs. The trade-off accepted by staying with the raw CLI: its spec sync is a mechanical merge, not the smarter "agent-driven intelligent merge" `/opsx:sync` performs — fine for this change's own simple additive delta spec, but worth revisiting if a future change's archive needs to reconcile more complex/conflicting delta specs (at that point, syncing via `/opsx:sync` headlessly — independent of the archive/move step — could be added without reopening this decision).

**Change/feature resolution: a small standalone script, not a new `lv` command.**
Add `scripts/ci/resolve-merged-change.mjs` (plain Node + `js-yaml`, both already available since `npm ci` runs first). It scans `docs/changes/*/state.yaml`, finds the one entry whose `branch` field equals the merged PR's head ref, and writes `change-id`, `openspec-changes` (JSON array), and `feature-ids` (JSON array) to `$GITHUB_OUTPUT`. If no entry matches, it exits successfully with empty outputs.
*Alternative considered:* reuse `matchBranch()`/`readState()` from `src/engine/` via a new `lv` subcommand (e.g. `lv ci resolve`). Rejected — the proposal explicitly keeps this CI-only, and `matchBranch()`'s job (inferring a ticket ID from a branch *pattern*) is unnecessary here since `state.yaml.branch` already holds the exact branch string to match against.

**OpenSpec CLI version: a single pinned-version file.**
Add a root `.openspec-version` file (plain text, e.g. `1.12.0`). The workflow runs `npm install -g @fission-ai/openspec@"$(cat .openspec-version)"` instead of installing `latest`. README instructs engineers to bump this file (and confirm their local `openspec --version` matches) whenever they intentionally upgrade the OpenSpec CLI.
*Alternative considered:* hardcode the version string inline in the workflow YAML. Rejected — harder to discover, easy to forget when upgrading locally, and not reusable if a second workflow ever needs the same version.

**Headless feature-doc refresh: `claude -p` per feature ID, authenticated via `CLAUDE_CODE_OAUTH_TOKEN`.**
Install the Claude Code CLI in the runner and invoke it non-interactively (`claude -p "<prompt invoking the lv-bootstrap skill for feature <id>>"`) once per feature ID output by the resolution script, scoped with `--add-dir`/`--allowedTools` to the repo working directory. Authentication uses the long-lived subscription token produced by `claude setup-token`, stored as the `CLAUDE_CODE_OAUTH_TOKEN` repo secret — matching Anthropic's documented pattern for running Claude Code non-interactively under a Claude subscription rather than metered API billing. Confirm the exact expected env var name against current Claude Code docs at implementation time (tasks.md calls this out).
*Alternative considered:* `ANTHROPIC_API_KEY`. Rejected per explicit user decision — they want the subscription/token-based flow with a documented re-auth path, not API-key billing.

**Commit strategy: direct push to the default branch, skip if nothing changed.**
After archive + doc-refresh steps, `git add -A -- openspec/ docs/`, commit under a bot identity only if `git diff --cached --quiet` reports staged changes, then push. On a push rejection (a race with another merge), retry once with `git pull --rebase` then push; if that still fails, let the job fail rather than force-pushing.
*Alternative considered:* open a follow-up PR instead. Rejected per explicit user decision (direct-to-main).

**Idempotency: treat a missing change directory as already archived.**
Before archiving a given change name, check whether `openspec/changes/<name>/` still exists (`openspec archive` removes it on success). If it's already gone, skip that change instead of erroring.

## Risks / Trade-offs

- **Direct-to-main commit skips human review of generated content** → Accepted per explicit user decision; scope the bot's diff strictly to `openspec/specs/`, the archived change's own directory, `docs/changes/<id>/state.yaml`, and `docs/features/<id>/*`, so an engineer can still audit it after the fact via normal `git log`/`git show`.
- **Long-lived Claude Code token expires** → `claude setup-token` tokens aren't indefinite; the "authentication failure is surfaced" requirement fails the run visibly instead of silently skipping doc refresh, and the README documents the re-auth/rotation steps.
- **Headless `lv-bootstrap` run has no human in the loop before its commit lands on main** → Accepted trade-off of choosing full automation; mitigated only by the skill's existing behavior of refining an existing draft against fresh exploration rather than fabricating from scratch.
- **Concurrent merges racing the bot's push** → Mitigated by one rebase-and-retry; a second collision fails the job loudly rather than silently dropping the sync.
- **Headless Claude Code run with broad tool access in CI** → Mitigated by scoping `--add-dir`/`--allowedTools` to just what `lv-bootstrap` needs (reading source, writing `docs/features/<id>/*`).

## Open Questions

(none — the one open question, the exact env var name for a `claude setup-token` credential, was resolved during implementation: `CLAUDE_CODE_OAUTH_TOKEN`, confirmed against [Claude Code's GitHub Actions docs](https://code.claude.com/docs/en/github-actions) and [anthropics/claude-code-action's setup guide](https://github.com/anthropics/claude-code-action/blob/main/docs/setup.md).)
