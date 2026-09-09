## Why

`lv bootstrap` in autonomous-scan mode can crash with a raw, opaque error — e.g. `Error: Unexpected token 'N', "Now let's "... is not valid JSON` — whenever the scan agent's final turn is narrative text instead of the required `{"overviewMarkdown":"...","designMarkdown":"..."}` envelope. `extractJson()` (`src/cli/helpers.ts`) only recovers JSON wrapped in code fences or trailing garbage after a balanced `{...}` block; when the response contains no `{` at all, it falls through to `JSON.parse()` on the raw narrative text, which throws a `SyntaxError` with no context about what the model actually said or how to recover. This surfaces as an unhandled exception/stack trace instead of a clear CLI error, and the engineer loses the generated content entirely.

## What Changes

- `extractJson()` throws a clear, actionable error (naming the artifact/call site and including a snippet of the actual response) when no JSON object can be found, instead of letting a raw `JSON.parse` `SyntaxError` propagate.
- `generateFeatureDocsFromScan()`'s scan-agent call (`src/cli/bootstrap.ts`) raises `maxSteps` from 18 to 30, since Anthropic models narrate ("Now let's...") before tool calls far more often than OpenAI models — each narrated turn still counts as a step, and this reproduces the reported bug on Anthropic while leaving OpenAI unaffected.
- The autonomous-scan flow (`generateFeatureDocsFromScan()` in `src/cli/bootstrap.ts`) detects a non-JSON or incomplete scan-agent response (including hitting `maxSteps` without a final answer) and retries once with an explicit follow-up turn asking the agent to emit the required JSON immediately, before giving up.
- If the retry also fails, `lv bootstrap` exits with a clear, actionable error via the existing `printError`/`process.exit(1)` pattern instead of crashing with an unhandled exception.

## Capabilities

### New Capabilities
- `lv-bootstrap/scan-json-parse-error-handling`: autonomous-scan mode recovers from a scan-agent response that isn't valid JSON by retrying once with a corrective nudge, and fails with a clear, actionable CLI error (not a raw parse exception) if the retry also comes back non-JSON.

### Modified Capabilities
(none — this failure path was not previously specified)

## Impact

- `src/cli/helpers.ts` — `extractJson()` error handling.
- `src/cli/bootstrap.ts` — `generateFeatureDocsFromScan()`, called by `lv bootstrap`'s autonomous-scan mode via `runBootstrapFromScan()`. (`lv start`'s inline feature bootstrap does not currently call this path — it only writes new-feature placeholder docs via `generateFeatureDocsPlaceholder()` — so it is unaffected by and out of scope for this change.)
- No changes to `src/cli/start.ts`'s other `extractJson()` call sites (`matchExistingFeature`, `inferFeatureSplit`) beyond benefiting from `extractJson()`'s clearer failure message — they are single-shot, non-tool-calling agent calls and are not in scope for the retry-with-nudge behavior.
- No breaking changes to the CLI's public command interface or output file formats.
