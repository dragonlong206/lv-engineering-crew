## Context

See proposal.md - Why. Both `startFromTicket()` and `startFromDescription()` in `src/cli/start.ts` currently call `createBranch()` (`git checkout -b`) unconditionally near the end of the flow, after ticket fetch, feature matching/allocation, feature-doc generation, and Lark syncing have all already run. `git checkout -b` fails outright if the branch already exists, so today a second `lv start` on the same change — or a branch left behind by an interrupted run or manual `git checkout -b` — hard-fails partway through, after side effects (LLM feature-matching calls, generated feature docs, Lark writes) have already happened.

`lv resume` (`src/cli/resume.ts`) already knows how to find a change's branch by ticket ID alone, independent of the rendered `{summary}` slug, using `matchBranch()`/`listBranchesMatching(branchGlobs(config))` filtered by `matchBranch(...).ticketId`. It also already prompts via `promptSelect()` when more than one branch matches.

## Goals / Non-Goals

**Goals:**
- Detect an existing change branch before any side-effecting work (Lark fetch, LLM feature matching, doc generation, Lark writes) happens, not just before the `git checkout -b` call.
- Reuse `lv resume`'s existing branch-lookup and multi-candidate-prompt logic rather than inventing a second way to find a change's branch.
- Keep "resume" and "restart" cheap and predictable: resume never redoes already-completed side effects; restart reproduces exactly what a first-time `lv start` would have done.

**Non-Goals:**
- Pushing or deleting anything on `origin`. `lv start` does not currently push (the `push()` helper is imported in `start.ts` but never called), so "existing branch" in practice means a local branch or one previously fetched (e.g. by `lv resume`); restart only ever deletes a *local* branch ref. Deleting a remote branch is a separate, explicitly-confirmed action this change does not add.
- Changing `lv resume`'s own behavior or its branch-lookup helpers beyond reusing them.

## Decisions

**Check by change ID, before any network/LLM calls, not by the fully-rendered branch name.**
For ticket-based starts, the change ID (the ticket ID) is known from the CLI argument alone — no Lark fetch is needed to compute it. For description-based starts, the change ID is available as soon as `deriveTitle()`/`changeIdSlug()` run, before the feature-matching LLM call. So the existing-branch check moves to the very start of each flow, using the same `matchBranch()`/`listBranchesMatching(branchGlobs(config))`-by-ticket-ID approach `lv resume` uses (falling back to `promptSelect()` if more than one branch matches a change ID, e.g. it was started once as `feature/...` and again as `hotfix/...`). This means:
- A "resume, `state.yaml` already exists" run needs **no Lark call at all** — same as `lv resume` today.
- A "resume, `state.yaml` missing" or "restart" run still needs the ticket fetch (for `title`/`description`/`feature_ids`), so that happens afterward, same as today.

Alternative considered: keep the check where `createBranch()` is currently called, right before branch creation. Rejected — it would still let feature matching, feature-doc generation, and Lark writes fire before failing/prompting, which is exactly the wasted-work problem the ticket describes ("branch exists without any documents or changes" implies these runs got interrupted after side effects already happened).

**Resume with a missing `state.yaml` falls through into the normal flow, on the checked-out branch.**
Rather than a separate code path, resume-without-state checks out the existing branch and then continues through the same feature-discovery → doc-generation → Lark-sync → `writeState()` → `commitAll()` sequence every other start already runs, skipping only the `createBranch()` call (the branch already exists and is already checked out). This keeps the "produce `state.yaml`" logic in one place.

**Resume with an existing `state.yaml` delegates to `lv resume`'s own summary output.**
Checks out the branch, reads `state.yaml`, and prints via `printStateSummary()` (already shared between `lv resume` and `lv status`) — instead of writing a second summary formatter — then stops, exactly like running `lv resume <ticket-id>` would.

**Restart deletes only the local branch ref, then re-enters the normal flow unchanged.**
Restart checks out the configured base branch and force-deletes the local branch (`git branch -D`), then proceeds through the exact same flow a first-time `lv start` follows, including the existing `createBranch()` call later in that flow. This means restart re-fetches the ticket, re-runs feature matching/allocation, and re-generates any missing feature docs — i.e. it is a true "start over," not a partial reset. `createBranch()` itself is unchanged.

**A dedicated resume-vs-restart prompt, not a reuse of `confirm()`/`promptSelect()` as-is.**
A small helper (alongside `confirm()`/`promptSelect()` in `src/cli/helpers.ts`) asks specifically "resume or restart" and names the branch, so the destructive nature of restart (discarding local commits on that branch) is stated up front rather than folded into a generic yes/no.

## Risks / Trade-offs

- **Restart discards local commits on the existing branch.** → The prompt explicitly names "restart" as discarding the branch's local history before the engineer confirms, consistent with how `lv start` already pauses for confirmation before other effectively-irreversible steps (e.g. proceeding past generated feature docs).
- **Matching by change ID alone (ignoring `{summary}` and, for ticket-based starts, `{type}`) can surface a branch created with a different `--type` than the current invocation.** → Same ambiguity `lv resume` already has; reusing its multi-candidate `promptSelect()` keeps the two commands consistent rather than introducing a second resolution rule.
- **Skipping Lark entirely on "resume, state.yaml exists" means ticket status/feature sync do not re-run.** → Intentional: those already ran (or were explicitly skipped) on the original `lv start`; re-running them on every resume would be surprising and is not what `lv resume` does today either.

## Migration Plan

None — purely additive CLI behavior; no persisted schema or state-file shape changes.
