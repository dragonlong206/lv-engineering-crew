# lv init

Analyzes one or more requirement documents (BRD/SRD/SSD, plain text, PDF, DOCX, or an HTML prototype; a Figma-style URL is accepted as an unfetched reference) and splits them into distinct features. Allocates a fresh `Fxxxx`-style feature ID for each and writes a requirements-derived draft `overview.md` — no code involved yet. Run `lv bootstrap <feature-id>` afterward to ground each draft in the actual codebase.

## Main code

- `src/cli/init.ts` — reads/dispatches input docs, calls the init agent, allocates IDs, writes drafts
- `src/tools/doc-readers.ts` — per-extension document loaders (md/txt/pdf/docx/html) + URL detection
- `src/engine/feature-id.ts` — `allocateFeatureIds`, scans `docs/features/` for the highest existing `Fxxxx` and continues from there
- `src/prompts.ts` — `buildInitPrompt`

## Flow

1. Read each input path (or record it as an unfetched reference if it's a URL) into a labeled document block
2. `initAgent.generate()` → strict JSON: one `{title, overviewMarkdown, sourceRefs}` per identified feature
3. `allocateFeatureIds()` → one new `Fxxxx` ID per feature
4. Write `docs/features/<id>/overview.md` for each, update `INDEX.md`
5. No auto-commit — review, edit, then run `lv bootstrap <id>` next
