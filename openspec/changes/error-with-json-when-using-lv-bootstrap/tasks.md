## 1. `extractJson()` error clarity

- [ ] 1.1 In `src/cli/helpers.ts`, wrap `extractJson()`'s `JSON.parse()` call(s) in a try/catch and re-throw a descriptive `Error` that includes a bounded snippet (~200 chars) of the input text on parse failure, instead of letting the raw `SyntaxError` propagate; verify by unit-testing (or a quick `tsx` scratch script) that `extractJson("Now let's write the docs...")` throws an error whose message contains that snippet rather than a bare `SyntaxError`.
- [ ] 1.2 Verify `npx tsc --noEmit` passes and the existing three call sites (`src/cli/bootstrap.ts`, `src/cli/start.ts`'s `matchExistingFeature()` and `inferFeatureSplit()`) still compile and behave the same on the valid-JSON path (no behavior change for well-formed responses).

## 2. Corrective retry in `generateFeatureDocsFromScan()`

- [ ] 2.1 In `src/cli/bootstrap.ts`, catch the parse error from step 1.1 around the `extractJson<{overviewMarkdown, designMarkdown}>()` call in `generateFeatureDocsFromScan()`.
- [ ] 2.2 On catch, issue one corrective follow-up `generate()` call to the same scan agent — continuing the prior conversation (per design.md Decision 3) with an appended message telling it its last reply did not contain the required JSON and to return `{"overviewMarkdown":"...","designMarkdown":"..."}` now — then re-attempt `extractJson()` on that response; verify by exercising the path with a scan agent stubbed/mocked to return narrative text on the first call and valid JSON on the second, confirming `overview.md`/`design.md` are written from the second response.
- [ ] 2.3 If the retry's response also fails to parse, propagate a clear, actionable error (naming the feature ID and including the snippet from step 1.1) up to `runBootstrapFromScan()`/`lv start`'s inline bootstrap caller, instead of writing any files; verify by exercising the path with a scan agent stubbed to return narrative text on both calls, confirming no `overview.md`/`design.md` are written and the process would exit non-zero.

## 3. CLI-level failure handling

- [ ] 3.1 In `runBootstrapFromScan()` (`src/cli/bootstrap.ts`), catch the actionable error from 2.3 and report it via the existing `printError` + `process.exit(1)` convention (matching `runBootstrapFromPaths()`'s existing error handling), instead of an unhandled exception; verify by running `lv bootstrap <feature-id>` against a scratch repo with the scan agent forced to fail twice and confirming a clean, readable error message and non-zero exit instead of a raw stack trace.
- [ ] 3.2 Confirm `lv start`'s inline feature bootstrap (which also calls `generateFeatureDocsFromScan()`) surfaces the same actionable error without crashing, by tracing its call site's error handling (or exercising it directly against a scratch repo/ticket) per spec.md's "Inline feature bootstrap shares the same recovery behavior" requirement.

## 4. Full verification

- [ ] 4.1 Run `npx tsc --noEmit` and `npm run build` and confirm both succeed with no new type or build errors.
- [ ] 4.2 Run `lv bootstrap <feature-id>` against a scratch repo in the normal (non-forced-failure) case and confirm `overview.md`/`design.md` are generated exactly as before, showing the retry path is inert when the scan agent's first response is already valid JSON.
