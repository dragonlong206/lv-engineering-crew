## Context

See `proposal.md` - Why/What Changes for motivation and scope. This is purely an internal
restructuring of `src/cli/start.ts` (596 lines today) and its immediate collaborators; no CLI
behavior, config schema, or `state.yaml` schema changes.

Current shape, concretely:
- `startFromTicket()` (~260 lines) inlines: existing-branch resolution → Lark credential check
  → Lark token fetch → `fetchTicket()` → attachment download → feature-ID-missing branch
  (feature matching via two module-level Mastra `Agent`s, or split-inference + allocation) →
  placeholder doc generation + confirm → `syncFeatureToLarkTable()` per feature → Lark
  feature-ID write-back (`config.lark.sync_feature_id` branch) → Lark status write-back
  (`config.lark.sync_status` branch) → branch creation → state assembly → commit.
- `startFromDescription()` (~65 lines) inlines a shorter variant of the same shape (no ticket
  fetch, no attachments, no placeholder-doc step, no Lark write-backs).
- `resolveExistingBranch()` (already a standalone function in the same file) is shared by both.
- Existing precedent for where collaborator modules live: `src/engine/` (pure-ish domain logic:
  `branch-naming.ts`, `feature-id.ts`, `state-io.ts`) and `src/integrations/` (external-system
  clients: `git/client.ts`, currently just git). `src/tools/lark.ts` already imports
  `printInfo`/`printWarn` from `src/cli/helpers.js`, so non-`cli/` modules printing
  user-facing output via those helpers is an established pattern, not a new one.
- `CLAUDE.md`'s "Command wiring" convention — one lazy `import` + one `runX()` call per
  `src/index.ts` command, no separate controller/service layer — governs the `src/index.ts` →
  `src/cli/start.ts` boundary specifically. It does not prevent `runStart()`'s internals from
  composing smaller collaborator modules; `start.ts` already does this today (`engine/`,
  `tools/lark.ts`, `integrations/git/`). This design continues that pattern rather than
  introducing a new layering style.

## Goals / Non-Goals

**Goals:**
- Put a seam (Dependency Inversion) between `lv start`'s orchestration and Lark specifically, so
  a future second ticket system is a new file implementing an interface, not a change to
  `startFromTicket`'s control flow (Open/Closed).
- Give each extracted piece one reason to change (Single Responsibility): ticket I/O, feature
  matching, branch resolution, and change orchestration become four separate concerns instead of
  one function doing all four.
- Preserve `lv start`'s observable behavior exactly: same prompts, same console output (including
  exact wording), same Lark API call sequence, same `state.yaml` output, same error/exit
  behavior.

**Non-Goals:**
- Implementing a second `TicketSource` (Jira, GitHub Issues, etc.) or a config key to select
  one. See proposal.md's "Non-goals" - only the seam is built, not a second consumer of it.
- Changing `ConfigSchema.lark` to become optional/pluggable, or restructuring `.lv.yaml`. The
  existing config shape is untouched.
- Moving `syncFeatureToLarkTable()` (feature docs → Lark Features table) behind `TicketSource`.
  It syncs feature documentation, not ticket state, and is used by `lv bootstrap` independent of
  any ticket source — kept as a direct `src/tools/lark.ts` call from `start.ts`, as today.
- Adding tests. The repo has no automated test suite (`CLAUDE.md`); verification here is
  `tsc --noEmit` + `npm run build` + manual `lv start` runs (ticket and `--description` paths)
  diffed against current behavior.

## Decisions

**1. `TicketSource` interface lives in `src/integrations/tickets/types.ts`, with a single
`LarkTicketSource` implementation in `src/integrations/tickets/lark-ticket-source.ts`.**

Mirrors the existing `src/integrations/git/` shape (a subdirectory per external system). Chose
a new `tickets/` subdirectory over adding to `src/tools/lark.ts` directly because
`src/tools/lark.ts` already serves a different role (raw Lark Bitable API wrapper + Mastra
`larkTicketTool` definition, also consumed by `bootstrap.ts` for feature-table sync); mixing an
abstraction-adapter concern into that file would make it a dumping ground for both "the Lark API
client" and "the thing that makes Lark plug into `TicketSource`". Keeping them separate means
`src/tools/lark.ts` doesn't need to know a `TicketSource` interface exists at all.

Interface shape:
```ts
export interface Ticket {
  id: string;
  title: string;
  description: string;
  featureIds: string[];
  uiDesignRefs: string[];
  attachments: { fileToken: string; name: string }[];
  projectRefs: string[]; // opaque; only meaningful to the source that produced it (e.g. Lark
                          // Projects-table record IDs) and to syncFeatureToLarkTable(), which
                          // is not part of this interface (see Non-Goals)
  raw: unknown;           // source-specific extra state a write-back method may need back
                           // (e.g. Lark's featureIdFieldIsLink + rawFields), opaque outside the
                           // source that produced it
}

export interface TicketSource {
  fetch(ticketId: string): Promise<Ticket>;
  downloadAttachments(
    ticket: Ticket,
    destDir: string,
  ): Promise<{ downloaded: string[]; failed: { name: string; error: string }[] }>;
  updateFeatureId(
    ticket: Ticket,
    featureIds: string[],
    featureRecordIds: Map<string, string>,
  ): Promise<void>;
  updateStatus(ticket: Ticket): Promise<void>;
}
```

`updateFeatureId`/`updateStatus` return `void` and never throw for expected failure modes
(disabled-by-config, or the underlying Lark call failing) — matching today's behavior where
`startFromTicket` treats both as non-fatal. Each method owns printing its own outcome (success,
warning, or "sync disabled") so a future source can word its own messages appropriately (e.g. a
"skipped: no Jira write access configured" message would look different from Lark's); this is
why the `config.lark.sync_feature_id`/`config.lark.sync_status` branches and their `printInfo`/
`printSuccess`/`printWarn` calls move from `start.ts` into `LarkTicketSource`, verbatim.

*Alternative considered*: split into narrower `TicketReader`/`TicketWriter` interfaces (Interface
Segregation taken further). Rejected for now — every current and plausible near-term caller
(`startFromTicket`) needs all four operations together, and `lv start` has exactly one call site
that would have to re-combine them anyway. Splitting further is speculative until a second
source or a read-only caller actually exists; the single `TicketSource` interface is still a
strict improvement over no interface at all.

*Alternative considered*: a class hierarchy (`abstract class TicketSource`) instead of a
structural interface + factory function. Rejected — the codebase has no class-based
abstractions outside the Mastra `Agent` SDK type; `createLarkTicketSource(config): TicketSource`
as a plain factory function matches the functional style everywhere else (`git/client.ts`,
`branch-naming.ts`).

*Addendum, found during implementation*: `syncFeatureToLarkTable()` (kept out of `TicketSource`
per Non-Goals) still needs a Lark tenant-access-token, and reusing the token `LarkTicketSource`'s
own methods already fetch/cache — rather than fetching a second one — is required to keep the
proposal's "same Lark API call sequence" promise. `createLarkTicketSource()` therefore returns
`LarkTicketSourceHandle` (`TicketSource` plus one extra `getAccessToken(): Promise<string>`
method), not the bare `TicketSource` interface. The extra method lives only on this concrete
return type, not on `TicketSource` itself, so it doesn't leak into the generic interface a
future source would implement; `startFromTicket`'s `syncFeatureToLarkTable()` call site — already
a direct, Lark-specific `src/tools/lark.ts` call — is the only caller that uses it.

**2. Lark credential validation and the "Fetching ticket..." message move into
`LarkTicketSource.fetch()`, not a separate `isReady()` pre-check.**

Today, `startFromTicket` checks `config.lark_app_id`/`lark_app_secret` and prints
`"Fetching ticket ${ticketId} from Lark Base..."` before calling `fetchTicket()`, in that order.
To keep console output byte-for-byte identical, both move into `LarkTicketSource.fetch()`
itself rather than into a separate pre-flight method `startFromTicket` would call first (which
would require `startFromTicket` to know two calls are needed instead of one, and risks the two
implementations drifting out of order). `startFromTicket` calls `source.fetch(ticketId)` once;
on a missing-credentials error it catches, prints the message via `printError`, and exits 1 -
matching today's `process.exit(1)` behavior exactly, just one layer up.

**3. No factory/selector abstraction for choosing a `TicketSource`.**

`startFromTicket` constructs `createLarkTicketSource(config)` directly - a single line. Adding a
`getTicketSource(config)` switch keyed on a not-yet-existing config value would be speculative
generality with no second branch to justify it (see Non-Goals). The seam that matters is the
interface itself; introducing a second source later means adding one file and changing this one
construction line (or, at that point, adding the config key and the switch) - not touching
`startFromTicket`'s control flow.

**4. `feature-matching.ts` and `branch-resolution.ts` extracted into `src/engine/`, verbatim.**

Both are already fairly self-contained functions in `start.ts` today (not entangled with Lark
specifics) - this is a pure move, not a rewrite. `src/engine/` already holds domain logic that
mixes pure functions with I/O (`state-io.ts` does file I/O; `feature-id.ts` reads the
filesystem), so a module that does LLM calls (`feature-matching.ts`) or prompts the user
(`branch-resolution.ts`) is consistent with what's already there, rather than requiring a new
top-level directory. Both keep their existing signatures; only their import paths change for
callers.

**5. `src/cli/start.ts` keeps its current two-function shape (`startFromTicket`/
`startFromDescription`), not a shared pipeline abstraction.**

The two entry points share collaborators (branch resolution, feature matching) but differ in
real ways today - only the ticket path fetches attachments, generates placeholder docs with a
confirm gate, and does Lark write-backs; the description path allocates no feature IDs on no
match. Forcing both into one parameterized pipeline function would either lose that asymmetry or
require a config object with several path-specific optional steps, which reads worse than two
short, linear functions that each call out to the same collaborator modules. This keeps the
"preserve exact behavior" goal simple to verify by inspection.

## Risks / Trade-offs

- [Extracting `resolveExistingBranch`/feature-matching changes import paths across the file] →
  Mitigation: `tsc --noEmit` catches every broken import immediately; both moves are copy-paste
  plus an adjusted `import` block, no logic edits.
- [Moving Lark-specific message strings into `LarkTicketSource` risks subtly changing wording or
  ordering] → Mitigation: tasks.md includes an explicit manual side-by-side run (ticket path)
  comparing console output before/after the refactor, not just a build check.
- [`Ticket.raw: unknown` is a weak type for write-back methods that need Lark-specific fields
  (`featureIdFieldIsLink`, `rawFields`) back] → Mitigation: `LarkTicketSource` internally casts
  `ticket.raw` to its own private shape (documented with a comment on the cast); this is an
  accepted trade-off of a structural interface over a generic type, consistent with how
  `LarkTicket.rawFields: Record<string, unknown>` already works today.
- [`startFromTicket` growing a second responsibility - "compose collaborators" plus "own the
  feature-doc placeholder + confirm gate" - if not watched] → Mitigation: tasks.md scopes the
  placeholder-doc-generation block to stay inline in `start.ts` (it's genuinely specific to `lv
  start`'s orchestration, not reusable), rather than extracting it into a module for its own
  sake.

## Migration Plan

Not applicable in the deploy/rollback sense - this ships as a normal PR. Sequencing (detailed in
tasks.md): add the new modules and interface first (additive, nothing calls them yet), then
switch `start.ts` over to use them, then delete the now-dead code paths from `start.ts`, then
verify. Rollback is a normal `git revert` of the merged commit(s) - no data migration, no
feature flag needed since behavior is unchanged.
