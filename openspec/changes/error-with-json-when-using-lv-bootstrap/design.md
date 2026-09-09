## Context

See proposal.md - Why. The concrete failure path is `generateFeatureDocsFromScan()` (`src/cli/bootstrap.ts:186-226`): it calls `createBootstrapScanAgent().generate(prompt, { model, maxSteps: 18 })`, extracts `result.text`, and pipes it straight into `extractJson<{overviewMarkdown, designMarkdown}>()` (`src/cli/helpers.ts`). `extractJson()` already tolerates code fences and trailing garbage after a balanced `{...}` block, but when the response contains no `{` at all, it falls through to a bare `JSON.parse()` on the raw text, throwing an uncaught `SyntaxError` that propagates out of `runBootstrapFromScan()` with no `try/catch`, killing the process with a raw stack trace. (`lv start`'s inline feature bootstrap does not call this path today — it only writes placeholder docs via `generateFeatureDocsPlaceholder()` — so it isn't affected.)

`BOOTSTRAP_AGENT_INSTRUCTIONS` (`src/prompts.ts`) already tells the model to "always produce a final JSON answer — never end your turn on a tool call," but a multi-step tool-calling agent can still finish with narrative text instead — e.g. by hitting `maxSteps` mid-exploration (a known gotcha already documented in this repo's `CLAUDE.md`: `finishReason: 'tool-calls'` pairs with empty/partial `text`), or by choosing to "announce" its next step ("Now let's...") right before what would have been its final tool call.

**Confirmed in the field, provider-specific:** the reporter hits this only with an Anthropic model configured for `models.bootstrap`/`model`, not with OpenAI models — `Error: Unexpected token 'N', "Now let's "... is not valid JSON` is exactly the "announce the next step" narration case above. Anthropic models are markedly more prone than OpenAI models to emitting this kind of "thinking out loud" text in the same turn immediately before a tool call, and each such narrated turn still counts as one step toward `maxSteps`. OpenAI models rarely narrate this way, so they don't burn steps on it and don't hit the cutoff. With `maxSteps: 18`, a narration-heavy Anthropic run can exhaust its step budget mid-exploration; at that point `result.text` holds only the last narration fragment ("Now let's...") rather than the final JSON envelope, and that's what reaches `extractJson()`. This is a second, independent way to land in the same no-`{`-at-all failure mode the retry logic below already has to handle — it's not a new failure mode, but it explains why the bug reproduces reliably on Anthropic and not on OpenAI.

## Goals / Non-Goals

**Goals:**
- Turn a scan-agent response with no parseable JSON into one corrective retry, then a clean, actionable CLI failure — never an unhandled exception.
- Keep the fix scoped to the scan-agent path (`generateFeatureDocsFromScan()`) and to `extractJson()`'s error clarity; do not change the JSON envelope's shape or the CLI's other flags/output.

**Non-Goals:**
- Not attempting to make the underlying LLM call deterministic or guaranteed to succeed — an actionable failure after one retry is an acceptable terminal state.
- Not changing `matchExistingFeature()`/`inferFeatureSplit()` in `src/cli/start.ts` beyond the shared `extractJson()` error-message improvement — those are single-shot, non-tool-calling calls where a bare-narrative-text response is far less likely, and adding retry there is out of scope for this ticket.
- Not introducing a generic "retryable LLM call" abstraction shared across all agents in this codebase — one targeted retry at the one call site that actually needs it, per this repo's preference against premature abstraction.

## Decisions

1. **Detect failure by catching `extractJson()`'s parse error, not by pre-inspecting `finishReason`.** `extractJson()` already centralizes "did this text contain valid JSON"; reusing it for detection (via try/catch) means both symptoms — no `{` at all, and a well-formed-looking but ultimately invalid JSON body — are handled by the same code path, instead of duplicating detection logic against `result.finishReason` (which only catches the `maxSteps`-cutoff case, not a model that simply chooses to narrate).

2. **`extractJson()` throws a dedicated, descriptive error instead of letting `JSON.parse`'s `SyntaxError` escape.** Wrap the parse in a try/catch inside `extractJson()` and re-throw an error that includes a bounded snippet (e.g. first ~200 chars) of the input text, so both the retry logic and the final CLI error message have something concrete to show the engineer. Alternative considered: leave `extractJson()` as-is and catch `SyntaxError` at each call site — rejected because the call site would then need to re-derive the same snippet from text it may no longer have in scope, and every future `extractJson()` caller would need to remember to do this themselves.

3. **Retry by continuing the same conversation with a corrective nudge, not by re-running the scan from scratch.** A full re-run repeats every exploration tool call (up to 18 steps) and cost; instead, the retry re-invokes the scan agent with the prior turn(s) plus one new user-role message telling it its last reply did not contain the required JSON and to return the JSON now, so the model reuses what it already found. Alternative considered: re-run `generateFeatureDocsFromScan()` from scratch on failure — rejected as needlessly expensive and no more reliable, since nothing about a from-scratch retry addresses why the model narrated instead of emitting JSON the first time.

4. **Exactly one retry, then fail.** Matches the proposal's scope and this repo's preference for simple, bounded behavior over configurable retry counts/backoff that this bug does not call for.

5. **On persistent failure, fail via the existing `printError` + `process.exit(1)` convention**, consistent with how `runBootstrapFromPaths()` and other CLI paths already report fatal errors, rather than introducing a new error-reporting mechanism.

6. **Raise `generateFeatureDocsFromScan()`'s `maxSteps` from 18 to 30.** Addresses the Anthropic-narration cause directly, ahead of the retry: giving the scan agent more step budget means a narration-heavy model is more likely to actually finish exploring and reach its final JSON turn within the original call, instead of relying on the retry to recover from a `maxSteps` cutoff every time. 30 is a generous-but-bounded multiple of the "aim to finish within about 10 tool calls" guidance already in `BOOTSTRAP_AGENT_INSTRUCTIONS` — enough headroom for narration turns interleaved with tool calls on a chatty model, without turning a runaway loop into an unbounded one. This is additive to, not a replacement for, the retry-with-corrective-nudge behavior (Decision 3): raising `maxSteps` reduces how often the retry path is needed, but the retry remains the backstop for whatever still slips through (narration that isn't step-budget-related, or a model that narrates again on the retry turn itself).

## Risks / Trade-offs

- **[Risk]** The corrective nudge message may itself not be enough to get valid JSON out of a model that's already confused (e.g., it ran out of useful exploration budget). → **Mitigation**: this is exactly the persistent-failure case the design already terminates cleanly on; the goal is a good error message, not a 100%-success retry.
- **[Risk]** Continuing the same conversation for the retry could still hit `maxSteps` again if the model tries to call more tools instead of answering. → **Mitigation**: the retry request explicitly asks for the JSON answer only (no further tool use expected); if it still doesn't arrive, the persistent-failure path handles it the same way.
- **[Trade-off]** Adding a snippet of raw model output to error messages could make CLI output noisier for this one failure mode. → Accepted: a bounded, truncated snippet is far more actionable than today's raw stack trace, and this only surfaces on an already-rare failure path.
- **[Trade-off]** Raising `maxSteps` from 18 to 30 lets a genuinely stuck/looping agent run longer (more tool calls, more tokens, more latency) before the CLI gives up on that call. → Accepted: exploration tool calls are cheap relative to the cost of a failed run the engineer has to re-invoke by hand, and 30 is still a hard bound, not unbounded retries.

## Open Questions

None — the retry-once-then-fail approach and its scope are settled above.
