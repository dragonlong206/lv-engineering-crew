## 1. Config schema

- [x] 1.1 Add `output_language: z.string().optional()` to `ConfigSchema` in `src/types.ts` and verify `npx tsc --noEmit` passes with `output_language: "Vietnamese"` set in a scratch `.lv.yaml`
- [x] 1.2 Document the new key with an inline comment matching the style of neighboring fields (e.g. `scan_extensions`) and verify `loadConfig()` returns `undefined` for `output_language` when unset (existing repos unaffected)

## 2. OpenSpec context wiring (lv-init/output-language)

- [x] 2.1 Add a new output-language instruction line to `src/prompts.ts` (alongside `CONTEXT_POINTER_LINES`) that tells the OpenSpec workflow to check `.lv.yaml`'s `output_language` and, when set, write generated artifact prose in that language, excluding code/identifiers/file paths/commands from translation — verify the constant's wording separately from the array so `addContextPointer()`'s per-line presence check picks it up like the others
- [x] 2.2 Run `lv init` against a scratch repo with `output_language` unset and verify `openspec/config.yaml`'s `context:` block gains exactly the new line, with existing lines unchanged
- [x] 2.3 Run `lv init` a second time on the same scratch repo and verify the `context:` block does not gain a duplicate copy of the new line
- [x] 2.4 Run `lv init` against a scratch repo whose `openspec/config.yaml` already has a customized (uncommented) `context:` key and verify the merge path (`addContextPointer()`'s YAML round-trip branch) still adds the new line without duplicating existing ones

## 3. Bootstrap agent wiring (lv-bootstrap/output-language)

- [x] 3.1 Add an optional `outputLanguage?: string` parameter to `buildBootstrapOverviewPrompt`, `buildBootstrapDesignPrompt`, and `buildBootstrapScanPrompt` in `src/prompts.ts`, appending a language instruction paragraph (prose only, code/identifiers/paths/commands excluded) to each prompt when the value is set
- [x] 3.2 Append the same language-instruction paragraph to `BOOTSTRAP_AGENT_INSTRUCTIONS` guidance used by `createBootstrapScanAgent()`, gated on the value being passed through, not hardcoded into the static instructions string
- [x] 3.3 Thread `config.output_language` from `loadConfig()` through `runBootstrapFromPaths` and `generateFeatureDocsFromScan` in `src/cli/bootstrap.ts` into the three builder calls above
- [x] 3.4 Run `lv bootstrap <feature-id> --paths <dir>` against a scratch repo with `output_language: "Vietnamese"` set and verify the generated `overview.md`/`design.md` prose is in Vietnamese while code fences/identifiers are untouched
- [x] 3.5 Run `lv bootstrap <feature-id>` (scan mode, no `--paths`) against a scratch repo with `output_language` set and verify the same language behavior, including when refining an existing draft written in a different language
- [x] 3.6 Run `lv bootstrap <feature-id>` with `output_language` unset and verify output is unchanged from current (pre-change) behavior, confirming no regression

## 4. Verification

- [x] 4.1 Run `npx tsc --noEmit` and `npm run build` and verify both succeed with no errors
- [x] 4.2 Run `openspec validate --change specify-output-language --strict` (or the project's equivalent) and verify it passes
