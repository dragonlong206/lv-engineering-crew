## 1. Ticket-source abstraction

- [x] 1.1 Create `src/integrations/tickets/types.ts` with the `Ticket` and `TicketSource`
      interfaces from design.md's Decision 1, and verify `npx tsc --noEmit` reports no errors
      for the new file in isolation (no other file references it yet).
- [x] 1.2 Create `src/integrations/tickets/lark-ticket-source.ts` exporting
      `createLarkTicketSource(config: Config): TicketSource`, implementing `fetch()` (Lark
      credential check + `"Fetching ticket ... from Lark Base..."` message + `getTenantAccessToken()`
      + `fetchTicket()`, token cached for the lifetime of the created source),
      `downloadAttachments()` (wraps `downloadTicketAttachments()`),
      `updateFeatureId()` (wraps `updateTicketFeatureId()`, including the
      `config.lark.sync_feature_id` enabled/disabled branch and its exact `printSuccess`/
      `printWarn`/`printInfo` messages moved verbatim from `startFromTicket`), and
      `updateStatus()` (wraps `updateTicketStatus()`, including the `config.lark.sync_status`
      branch and current-status comparison, messages moved verbatim). Verify with
      `npx tsc --noEmit`.

## 2. Feature-matching extraction

- [x] 2.1 Create `src/engine/feature-matching.ts` containing the module-level `featureMatchAgent`/
      `featureSplitAgent` `Agent` instances and `matchExistingFeature()`, `inferFeatureSplit()`,
      `summarize()`, `confirmFeatureMatches()`, moved verbatim from `src/cli/start.ts` (only
      import paths change, e.g. `../mastra/index.js` stays the same relative depth). Verify with
      `npx tsc --noEmit` against this file alone (unused-export warnings are expected until
      `start.ts` is rewired in Section 4).

## 3. Branch-resolution extraction

- [x] 3.1 Create `src/engine/branch-resolution.ts` containing `resolveExistingBranch()` moved
      verbatim from `src/cli/start.ts`, including its JSDoc. Verify with `npx tsc --noEmit`.

## 4. Rewire `src/cli/start.ts`

- [x] 4.1 Update `startFromTicket()` to construct `createLarkTicketSource(config)` once and
      replace its direct `src/tools/lark.ts` calls (`getTenantAccessToken`, `fetchTicket`,
      `downloadTicketAttachments`, `updateTicketFeatureId`, `updateTicketStatus`) and their
      surrounding credential-check/enabled-disabled branches with calls through the
      `TicketSource` interface (`source.fetch`, `source.downloadAttachments`,
      `source.updateFeatureId`, `source.updateStatus`). `syncFeatureToLarkTable()` stays a direct
      `src/tools/lark.ts` call, unchanged, per design.md's Non-Goals. Verify with
      `npx tsc --noEmit`.
- [x] 4.2 Update imports in `src/cli/start.ts` to pull feature-matching functions from
      `src/engine/feature-matching.ts` and `resolveExistingBranch` from
      `src/engine/branch-resolution.ts` instead of defining them locally; remove the
      now-duplicate local definitions and the now-unused `Agent`/`registerAgent`/
      `buildFeatureMatchPrompt`/`buildFeatureSplitPrompt` imports. Verify with
      `npx tsc --noEmit` (should report no unused-import errors) and `npm run build`.
- [x] 4.3 Confirm `src/cli/start.ts` no longer imports anything from `src/tools/lark.js` except
      what `syncFeatureToLarkTable()`'s call site needs, and no longer imports `@mastra/core/agent`
      or `../mastra/index.js` at all — grep for `from '../tools/lark` and `@mastra/core/agent` in
      the file and confirm the only remaining match (if any) is the `syncFeatureToLarkTable`
      import.

## 5. Verification

- [x] 5.1 Run `npx tsc --noEmit` and `npm run build` from repo root and confirm both succeed with
      no errors.
- [x] 5.2 Manually run `lv start <ticket-id>` (via `npm run dev -- start <ticket-id>`) against a
      ticket in a scratch/test Lark Base, and confirm the console output (prompts, messages,
      ordering), the resulting `docs/changes/<id>/state.yaml`, the created branch, and the Lark
      side-effects (feature-ID/status write-back, Features-table sync) are unchanged from the
      pre-refactor behavior described in `design.md`'s Context section.
- [x] 5.3 Manually run `lv start --description "<text>"` (via
      `npm run dev -- start --description "..."`) and confirm output/`state.yaml`/branch
      creation match pre-refactor behavior, including the case where feature matching finds no
      candidates (feature_ids stays empty, no placeholder docs generated).
- [x] 5.4 Manually exercise the existing-branch resume/restart path (`resolveExistingBranch`) for
      both a ticket-based and description-based change, confirming the resume/restart prompt and
      outcomes are unchanged.
