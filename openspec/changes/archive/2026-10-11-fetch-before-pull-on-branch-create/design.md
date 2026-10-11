## Context

`createBranch()` in `src/integrations/git/client.ts` runs `checkout <base>`, `pull --ff-only` (failure swallowed), then `checkout -b`. All three `start.ts` call sites go through it. See proposal.md.

## Goals / Non-Goals

**Goals:**
- Always fetch before checkout/pull so the base is current, including a base only present remotely.

**Non-Goals:**
- Changing restart (`discardLocalBranch`) or resume behavior.
- Surfacing fetch failures as errors.

## Decisions

- **Fetch inside `createBranch()`**, as a first step `git fetch origin` with `.catch(() => {})`. One place covers all call sites. Alternative: fetch in each caller — duplicative.
- **Keep `pull --ff-only` after checkout** rather than replacing it with a merge of `origin/<base>`: it preserves existing behavior and upstream tracking semantics.
- **Fetch failure stays silent/non-fatal**, matching the existing pull handling, so offline use still works.

## Risks / Trade-offs

- [Extra network round trip on every start] → Acceptable; fetch is incremental.
- [Local base diverged from remote makes ff-only pull fail] → Already swallowed; branch forks from local base as before.
