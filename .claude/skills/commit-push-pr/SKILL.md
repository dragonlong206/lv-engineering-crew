---
name: commit-push-pr
description: Commit the current changes, push the branch, and open a GitHub pull request with the gh CLI, with the PR body built from the change's OpenSpec docs (proposal, design, specs, tasks) when they exist. Also works when only the PR is wanted (work already committed): it then skips the commit and push as needed. Use whenever the user wants to ship work — "commit, push and create PR", "create a PR", "open a pull request", "send this up for review", "ship it", "push this and PR it". DO NOT use this skill if the user only mentions ("commit" or "push" or "commit and push") and doesn't mention a PR or a pull request.
allowed-tools: Bash(git:*), Bash(gh:*), Bash(openspec:*)
---

Take the working tree from "changes on disk" to "open PR", in one pass. Each step is cheap to do right and annoying to undo once pushed, so look before you act.

## 1. Inspect

Run these in parallel:

```bash
git status --short
git diff HEAD --stat
git branch --show-current
git log --format=%s -8
```

- The recent subjects tell you the repo's commit style (prefix conventions, `(#123)` suffixes, tense). Match it rather than imposing your own.
- If the working tree is clean and the branch has no commits ahead of its base, stop and say there is nothing to ship.
- Also check what's already on the remote: `git rev-list --count @{u}..HEAD 2>/dev/null` (fails when there's no upstream yet, which means nothing is pushed).

## 1b. Decide how far to go

The stages below (commit, push, PR) are each skipped when there's nothing left to do, so the same skill serves "ship everything" and "just open the PR". Decide from the request wording and the state you just read:

- **Ship it** ("commit, push and create PR", "ship it"): run every stage that has work. Dirty files that belong to the change → commit (3, 3b). Commits not on the remote → push (4). Then the PR (5).
- **PR only** ("create a PR", "open a PR for this branch", or the work is already committed and the user just wants the PR): the user didn't ask for a commit, so don't create one. Skip 3 and 3b, push only if commits are missing from the remote, then open the PR (5). If the tree has uncommitted changes, list them and say they won't be in the PR; ask only if they look like part of the work. Committing files the user didn't ask to commit is hard to take back once pushed.
- **Already pushed, PR exists**: report the existing PR URL and stop, unless the user asked to update it.

Step 2b (archiving) applies to "ship it" as-is. In PR-only mode, archiving would create new uncommitted files, so if the change isn't archived yet, ask once: "Archive it first? That adds one commit containing only the archive changes." Archive and commit only that on a yes; on a no, open the PR unarchived and say so in the report.

## 2. Pick the branch

- On the default branch (`main`/`master`, check with `git symbolic-ref refs/remotes/origin/HEAD`): create a new branch first. Committing straight to the default branch and pushing it bypasses review, which is the opposite of what a PR is for. Name it from the change (`fix/short-summary`), following any existing branch pattern visible in `git branch -a`.
- Already on a feature branch: stay on it.
- On the default branch with local commits ahead of `origin/<default>` (PR-only case): branch from `HEAD` so the commits come along, and tell the user local `main` still has them. Don't reset `main` without asking.

## 2b. Archive the OpenSpec change first

Ship the change already archived, so the PR carries the finished record (the change moved under `openspec/changes/archive/`, main specs updated, feature docs refreshed) instead of leaving a stale active change behind for a follow-up chore.

**Find the change name(s)** in this order, stopping at the first hit. Step 5a reuses the result.

1. `docs/changes/*/state.yaml` whose `branch:` equals the current branch. Its `openspec_changes:` list holds the names. (The change name usually differs from the ticket ID, so don't guess it from the branch name.) Also read `ticket_id`, `title` and `feature_ids` from it.
2. Otherwise, changes touched by this branch: `git diff <base>...HEAD --name-only | grep '^openspec/changes/'`, taking the directory name after `changes/` (or after `changes/archive/<date>-`).
3. Otherwise, an `openspec/changes/<name>/` that is untracked or modified in the working tree.

If nothing resolves, there is no OpenSpec work here: skip to step 3.

**Check each name.**

- `openspec/changes/archive/<date>-<name>/` exists and `openspec/changes/<name>/` does not: already archived, nothing to do.
- `openspec/changes/<name>/` exists: not archived yet, so archive it.

**Before archiving, look at `tasks.md`.** Archiving marks the change as done, so if it has unchecked tasks, don't archive on your own. Tell the user which tasks are open and ask whether to archive anyway, finish them first, or skip archiving. Likewise skip archiving when the user said this is work-in-progress or a draft, and say you skipped it.

**Archive** by running the repo's OpenSpec archive workflow (the `openspec-archive-change` skill, i.e. `/opsx:archive <name>`), and let it finish. In a repo wired by `lv init` it also follows the archive guidance (syncs delta specs into `openspec/specs/`, refreshes `docs/features/<id>/` via `lv bootstrap`), so don't redo those by hand. If it stops to ask something, relay the question to the user rather than answering for them. If archiving fails, stop and report; don't push a half-archived tree.

Afterwards `git status` should show the change moved into `openspec/changes/archive/`, plus updated `openspec/specs/` and `docs/features/` files. Those belong in this commit (step 3).

## 3. Stage deliberately

(Skip 3 and 3b when there's nothing to commit or in PR-only mode, per step 1b.)

Read the diff and decide which files belong to this change. `git add -A` sweeps in everything dirty, including unrelated edits, generated files, and secrets (`.env`, `*.local.yaml`, credentials). Stage by path instead. If some dirty files look unrelated to the work being shipped, leave them out and tell the user; if it's ambiguous which belong, ask.

If the repo documents that a tool auto-stages everything (check CLAUDE.md), heed that gotcha before running it.

Include the change's OpenSpec files and any `docs/changes/*/state.yaml` in the commit when they're part of this work, since the reviewer needs the plan alongside the code. After step 2b that means the archive move, so stage both the removed `openspec/changes/<name>/` paths and the new `openspec/changes/archive/<date>-<name>/` (for example `git add -A -- openspec/changes openspec/specs docs/features/<id>`, scoped to those paths only), plus the specs and feature docs the archive updated.

## 3b. Commit

Write the message from the actual diff: a short imperative subject (≤72 chars) saying what changed and why it matters, plus a body only when the _why_ isn't obvious from the subject. Pass it via heredoc so formatting survives:

```bash
git commit -m "$(cat <<'EOF'
Subject line

Optional body.
EOF
)"
```

Add any commit attribution line the session's instructions call for. If a pre-commit hook fails, fix the cause and make a new commit — don't bypass with `--no-verify`.

## 4. Push

Skip if the remote already has every commit (step 1's `@{u}..HEAD` count is 0).

```bash
git push -u origin "$(git branch --show-current)"
```

Never force-push unless the user explicitly asked; if the push is rejected, report why and ask. If there is no `origin` remote, stop and say so.

## 5. Open the PR

Base is the repo's default branch unless the user or repo conventions (e.g. a gitflow `develop`) say otherwise. First check whether a PR already exists for this branch: `gh pr view --json url 2>/dev/null` — if one does, the push already updated it, so just report its URL instead of creating a duplicate.

Otherwise, review **all** commits going into the PR (`git log <base>..HEAD`, `git diff <base>...HEAD --stat`), then build the body from the OpenSpec docs if the work has any (5a), falling back to the diff alone if not (5b).

### 5a. Find the OpenSpec change(s)

The change's proposal, design and tasks were already written to explain this work, so reuse them instead of re-summarizing the diff. That keeps the PR faithful to what was planned and spares the reviewer two slightly different stories. Use the change names resolved in step 2b (re-run that lookup if you skipped straight here).

Because of step 2b the files normally live at `openspec/changes/archive/<date>-<name>/`. Fall back to `openspec/changes/<name>/` if archiving was skipped. Point the "OpenSpec change" footer at whichever path actually exists. If no change resolved, go to 5b.

Read `proposal.md`, `tasks.md`, `design.md` and the `specs/**/spec.md` deltas, and compose:

```markdown
## Summary

<the proposal's "Why", condensed to 1–3 sentences>

## What changed

<the proposal's "What Changes" bullets, kept close to verbatim>

## Specs

- `<capability path>` — <new | modified>, one line each from the `specs/` deltas

## Design notes

<2–4 bullets: key decisions and non-obvious trade-offs; omit if there's no design.md>

## Test plan (per tasks.md)

<derived from tasks.md, see below>

**OpenSpec change:** `openspec/changes/<name>/` · **Ticket:** <ticket_id, if any>
```

- **Test plan:** turn the "verify by …" clauses in `tasks.md` into checklist items, merging near-duplicates into a few lines rather than mirroring every task. Mark `- [x]` when the task is checked off in `tasks.md` (that's the author's record of having done it) and add "(per tasks.md)" to the section heading so the reviewer knows the source. Leave `- [ ]` for unchecked tasks. Never tick a box for anything `tasks.md` doesn't mark done, even if it seems likely to pass. If you ran a check yourself this session, say so next to it.
- **Doc-only tasks:** tasks that only refresh docs (e.g. "refresh `docs/features/<id>/…`") aren't tests. Mention them under "What changed" and keep them out of the test plan.
- **Design notes length:** at most 4 bullets. Link to `design.md` for the rest.
- **Unfinished tasks:** if `tasks.md` has unchecked tasks, say so in one line under the plan ("Tasks 3.2–3.3 not done yet") and tell the user. A PR that silently omits planned work misleads reviewers. Don't hold the PR back for it unless the user asks.
- **Link, don't paste:** point to the change directory by path. The body should orient a reviewer, not duplicate the docs.
- **Several changes on one branch:** one group per change under a shared Summary, not one merged blob.
- **Title:** prefer `state.yaml`'s `title`, else the proposal's first line. Keep it under 70 chars in the repo's commit-subject style, and add a ticket prefix only if recent history does.
- **PR template:** if `.github/pull_request_template.md` exists, keep its headings and fill them with this content.

### 5b. No OpenSpec docs

Use a plain body:

```markdown
## Summary

- What changed and why, 1–3 bullets

## Test plan

- [ ] How it was verified (commands run, what to check)
```

List only what was really run or what a reviewer should check. Don't claim tests passed if you didn't run them.

### Create it

```bash
gh pr create --base <base> --title "<title>" --body "$(cat <<'EOF'
<body>
EOF
)"
```

Add any PR-description attribution line the session's instructions call for. Use `--draft` if the user said work-in-progress or the change is clearly incomplete.

## 6. Report

Give the user the PR URL, the branch name, which OpenSpec change(s) the body came from (or that none were found) and whether you archived them or skipped archiving (and why), and one line on anything you deliberately left out of the commit. If `gh` isn't authenticated, tell them to run `! gh auth login` themselves rather than trying to work around it.
