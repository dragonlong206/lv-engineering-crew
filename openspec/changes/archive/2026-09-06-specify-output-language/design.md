## Context

See proposal.md - Why. Two independent code paths generate LLM prose in this repo, and both need to honor the same setting:

1. **OpenSpec-driven generation** — the coding agent, running `/opsx:propose`/`/opsx:apply`/`/opsx:sync`/`/opsx:archive`, writes `proposal.md`/`specs/**/spec.md`/`design.md`/`tasks.md` and touches project code. LV never calls this LLM directly; it only shapes the project-wide `context:` string in `openspec/config.yaml` that every OpenSpec workflow reads (`CONTEXT_POINTER_LINES` in `src/prompts.ts`, written by `addContextPointer()` in `src/cli/init.ts`).
2. **`lv bootstrap`'s own agents** — `bootstrapAgent.generate(...)` (single-shot, `--paths` mode) and `createBootstrapScanAgent()` (tool-equipped scan mode), both in `src/cli/bootstrap.ts`/`src/agents/bootstrap-agent.ts`, called directly by LV with a fully-built prompt string (`buildBootstrapOverviewPrompt`/`buildBootstrapDesignPrompt`/`buildBootstrapScanPrompt` in `src/prompts.ts`).

Both need to consult the same repo-level `output_language` setting from `.lv.yaml`/`ConfigSchema` (`src/types.ts`), loaded via `loadConfig()`.

## Goals / Non-Goals

**Goals:**
- One config key controls output language for both code paths.
- The OpenSpec-side instruction stays valid even if the configured language later changes, without re-running `lv init` (matches how `CONTEXT_POINTER_LINES` already points at `docs/changes/<change-id>/state.yaml` rather than embedding its contents).
- Existing repos with no `output_language` set see zero behavior change.

**Non-Goals:**
- Validating or normalizing language values (e.g. against ISO 639 codes) — `output_language` is a free-text string ("Vietnamese", "vi", "Spanish (Latin America)" all pass through as-is); the LLM interprets it.
- Per-artifact or per-command language overrides — one setting applies repo-wide to both paths.
- Translating existing, already-committed docs — this only affects newly generated/refined output.

## Decisions

**`output_language` lives in `.lv.yaml`, not `openspec/config.yaml`, as the single source of truth.** `openspec/config.yaml`'s `context:` pointer is patched to tell the OpenSpec-side agent to go read it there, the same indirection `CONTEXT_POINTER_LINES` already uses for `state.yaml` and feature docs. Alternative considered: write the language value directly into `openspec/config.yaml`'s context text. Rejected — every existing pointer line references a file/config key rather than embedding a value, specifically so changing the value doesn't require re-running `lv init`; embedding the language would break that invariant and silently go stale.

**The new context-pointer line is static text (a new entry in `CONTEXT_POINTER_LINES`), not templated per-repo.** It reads roughly: "check `.lv.yaml` for `output_language`; if set, write generated artifact prose in that language (code/identifiers/file paths/commands stay untranslated)." `addContextPointer()`'s existing per-line presence check (`CONTEXT_POINTER_LINES.filter(line => !normalizedRaw.includes(...))`) handles idempotency for free — no new write path needed in `init.ts`.

**Bootstrap's prompt builders take the language as an added parameter, not a wrapped hint object.** `buildBootstrapOverviewPrompt`, `buildBootstrapDesignPrompt`, and `buildBootstrapScanPrompt` each gain one new optional trailing parameter (`outputLanguage?: string`) rather than being restructured to take an options object. Alternative considered: fold it into `BootstrapScanHint` (`hint.outputLanguage`). Rejected for the two single-shot builders — `buildBootstrapOverviewPrompt`/`buildBootstrapDesignPrompt` have no hint object today and take positional args directly; adding one non-hint parameter is the smaller diff and matches their existing shape. `buildBootstrapScanPrompt` already takes many positional args, so it follows the same pattern instead of special-casing scan mode via `BootstrapScanHint`, keeping the language plumbing (`runBootstrap` → `loadConfig().output_language` → each builder) identical for both paths.

**When set, the language instruction is appended as its own paragraph to each prompt/instruction string**, not interleaved into the existing bullet lists (`overview.md should cover: ...` etc. in `buildBootstrapOverviewPrompt`/`buildBootstrapDesignPrompt`, and the corresponding section of `BOOTSTRAP_AGENT_INSTRUCTIONS`/`buildBootstrapScanPrompt`). Keeps the diff minimal and the instruction easy to grep/verify in isolation.

## Risks / Trade-offs

- **[Risk]** A free-text `output_language` value gives the LLM no strict validation — a typo'd or unsupported language name silently produces English (or whatever the model defaults to) instead of erroring. → **Mitigation**: none needed for v1; this mirrors how every other LLM-steering config in this repo (`model`, `models.bootstrap`) is also unvalidated free text trusted to the provider. Document expected values (a plain language name) in `.lv.yaml`'s schema comment.
- **[Risk]** The OpenSpec-side instruction is advisory only — same as every other `context:` pointer line, an engineer's coding agent could ignore it. → **Mitigation**: consistent with this repo's existing trust model (`ARCHIVE_GUIDANCE` is advisory too); no enforcement mechanism exists or is being added here.
- **[Risk]** Headings/identifiers left untranslated next to translated prose could read awkwardly in some languages. → **Mitigation**: explicitly instruct headings may stay in English per the proposal's "What Changes"; this is a reasonable, documented default rather than a hard requirement, so an engineer can adjust by hand if it reads poorly.

## Migration Plan

No migration needed — `output_language` is a new optional field; repos without it keep current behavior. Existing repos that already ran `lv init` re-run it (as they must for any `CONTEXT_POINTER_LINES` change) to pick up the new pointer line; `addContextPointer()`'s per-line diff means this is a no-op no-duplication re-run, not a destructive one.
