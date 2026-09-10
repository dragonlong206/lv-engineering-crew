---
name: lv-bootstrap
description: Generate or refine a feature's overview.md/design.md by exploring the repo directly, without a separate LLM call. Use when creating or refreshing docs/features/<feature-id>/{overview.md,design.md}.
allowed-tools: Bash(lv bootstrap:*)
metadata:
  author: lv
---

Generate or refine a feature's `overview.md`/`design.md` by exploring this repository's actual code — grounded in what you read yourself, not a separate LLM call.

## 1. Get context

Run (no LLM call, just prints JSON):

```bash
lv bootstrap <feature-id> --context [--paths <comma-separated-paths>] [--name <hint>] [--description <hint>]
```

This prints one JSON object with: `repoRoot`, `overviewPath`, `designPath`, `scanExtensions`, `scanSkipDirs`, `outputLanguage` (omitted when unset), `existingOverviewMarkdown`/`existingDesignMarkdown` (omitted when no draft exists yet), `paths` (only present when `--paths` was given — already expanded from any directory into a capped file list), and `name`/`description` (only present when given as hints). It also creates the feature directory so you can write into it right away. This command never reads file *contents* for you — only resolves *which* files are relevant when `--paths` narrows the scope.

## 2. Explore

- If `paths` is present in the context JSON: read only those files with your own tools. Do not explore the rest of the repository.
- If `paths` is absent: explore the repository yourself (list/glob/grep/read) to find the code relevant to `<feature-id>`. Use `name`/`description`, if present, as a starting hypothesis for where to look, not as text to copy into the output. If the feature is a CLI command, tool, or public API, search for where it's registered/exposed so you capture its current full set of flags/parameters, not just what one implementation file suggests.
- Be economical: narrow down to the handful of files that actually matter, then read only those.

## 3. Refine an existing draft, don't just restate it

If `existingOverviewMarkdown`/`existingDesignMarkdown` is present, treat it as a draft to verify and refine — not to copy forward with light rewording. Keep sections whose claims you've verified are still true (e.g. purpose/scope/constraints that aren't about code), and rewrite any section whose factual claims are about the code (function signatures, CLI flags/options, file names, module names, architecture) purely from what you observe in this run's own exploration. Never trust the draft for a code fact — verify it, and if you didn't check it, don't assert it. A draft that's gone stale (renamed functions, new options, new files) is the normal case, not the exception.

## 4. Write the docs

Write `overviewPath` and `designPath` (from the context JSON) directly with your own file-writing tool. Prepend this exact header to both files, followed by a blank line, before the content:

```
<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->
```

`overview.md` must cover: Purpose of the feature, Main components, High-level flow, Constraints and assumptions, Current state of the code.
`design.md` must cover: Architecture and layers, Data model / schema, APIs / interfaces, Key design decisions.

Be concise. Do not use em-dashes for parenthetical remarks. If `outputLanguage` is present in the context JSON, write all descriptive prose in that language — leave code blocks, identifiers, file paths, and command names untranslated; headings may stay in English.

## 5. Finalize

Once both files are written, run (no LLM call):

```bash
lv bootstrap <feature-id> --finalize --title "<short human-readable title derived from the overview you just wrote>"
```

This updates `docs/features/INDEX.md` and syncs the feature to Lark when that's configured — you don't need to do either yourself.
