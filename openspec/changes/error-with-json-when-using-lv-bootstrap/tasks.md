## 1. `extractJson()` error clarity

- [x] 1.1 In `src/cli/helpers.ts`, wrap `extractJson()`'s `JSON.parse()` call(s) in a try/catch and re-throw a descriptive `Error` that includes a bounded snippet (~200 chars) of the input text on parse failure, instead of letting the raw `SyntaxError` propagate; verify by unit-testing (or a quick `tsx` scratch script) that `extractJson("Now let's write the docs...")` throws an error whose message contains that snippet rather than a bare `SyntaxError`.
- [x] 1.2 Verify `npx tsc --noEmit` passes and the existing three call sites (`src/cli/bootstrap.ts`, `src/cli/start.ts`'s `matchExistingFeature()` and `inferFeatureSplit()`) still compile and behave the same on the valid-JSON path (no behavior change for well-formed responses).

## 2. Corrective retry in `generateFeatureDocsFromScan()`

- [x] 2.0 In `src/cli/bootstrap.ts`, raise `generateFeatureDocsFromScan()`'s `scanAgent.generate(prompt, { model, maxSteps: 18 })` to `maxSteps: 30` (per design.md Decision 6) — Anthropic models narrate before tool calls more often than OpenAI models, and each narrated turn still counts as a step, so the original 18-step budget can cut an Anthropic-driven scan off mid-exploration before it reaches a final JSON answer; verify by confirming this is the only `maxSteps: 18` occurrence (`grep -rn maxSteps src/`) and that it's now `30`.
- [x] 2.1 In `src/cli/bootstrap.ts`, catch the parse error from step 1.1 around the `extractJson<{overviewMarkdown, designMarkdown}>()` call in `generateFeatureDocsFromScan()`.
- [x] 2.2 On catch, issue one corrective follow-up `generate()` call to the same scan agent — continuing the prior conversation (per design.md Decision 3) with an appended message telling it its last reply did not contain the required JSON and to return `{"overviewMarkdown":"...","designMarkdown":"..."}` now — then re-attempt `extractJson()` on that response; verify by exercising the path with a scan agent stubbed/mocked to return narrative text on the first call and valid JSON on the second, confirming `overview.md`/`design.md` are written from the second response.
- [x] 2.3 If the retry's response also fails to parse, propagate a clear, actionable error (naming the feature ID and including the snippet from step 1.1) up to `runBootstrapFromScan()`'s caller, instead of writing any files; verify by exercising the path with a scan agent stubbed to return narrative text on both calls, confirming no `overview.md`/`design.md` are written and the process would exit non-zero.

## 3. CLI-level failure handling

- [x] 3.1 In `runBootstrapFromScan()` (`src/cli/bootstrap.ts`), catch the actionable error from 2.3 and report it via the existing `printError` + `process.exit(1)` convention (matching `runBootstrapFromPaths()`'s existing error handling), instead of an unhandled exception; verify by running `lv bootstrap <feature-id>` against a scratch repo with the scan agent forced to fail twice and confirming a clean, readable error message and non-zero exit instead of a raw stack trace.

## 4. Full verification

- [x] 4.1 Run `npx tsc --noEmit` and `npm run build` and confirm both succeed with no new type or build errors.
- [x] 4.2 Run `lv bootstrap <feature-id>` against a scratch repo in the normal (non-forced-failure) case and confirm `overview.md`/`design.md` are generated exactly as before, showing the retry path is inert when the scan agent's first response is already valid JSON.
