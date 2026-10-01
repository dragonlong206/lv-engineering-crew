## Context

`addOperationGuidance()` (`src/cli/init.ts`) has two branches:

- **Fresh append**: used when no active `operations:` key exists. It writes each value through `JSON.stringify`, so values are always quoted. This has been the case since `797e2b2`.
- **YAML merge**: used when `operations:` is already active. It runs `yaml.load` → mutate → `yaml.dump`.

The original archive-guidance writer (`5377e7f`) wrote `      - ${ARCHIVE_GUIDANCE}` unquoted. The legacy wording contains `` `lv bootstrap <feature-id>`: use ``, so js-yaml (and OpenSpec's parser) load that item as `{ "<text up to the colon>": "<rest>" }`.

Verified with js-yaml against the legacy text: the merge branch's `normalizeWhitespace(String(entry))` gives `"[object Object]"`. Neither the `text` nor the `legacy` match fires, so the current wording is pushed, and `yaml.dump` re-emits the mapping as `` - When archiving, ... `lv bootstrap <feature-id>`: >- `` followed by a folded value. This is byte-for-byte the shape in the ticket. OpenSpec then rejects the whole `guidance` array, since every item must be a string.

`addArtifactRules()` has the same merge shape (`String(entry)` comparison) but has always quoted LV's own rule text.

## Goals / Non-Goals

**Goals:**
- Re-running `lv init` turns an affected `openspec/config.yaml` into one OpenSpec accepts, with exactly one copy of the current archive guidance.
- Keep any non-LV guidance/rules text the engineer wrote, even if it was itself unquoted.

**Non-Goals:**
- Repairing malformed YAML outside `operations.<id>.guidance` / `rules.<artifact-id>` lists (e.g. `context:`, which is a scalar and not affected).
- Preserving template comments on the repair rewrite. The merge branch already drops them, and this change keeps that trade-off.
- A separate `lv doctor`/repair command. `lv init` is already the documented upgrade path for LV-owned config entries.
- Detecting or repairing the problem at `lv start`/`lv status` time.

## Decisions

### D1: Recover the intended string from a one-key mapping, not drop it
Add a small helper, e.g. `coerceGuidanceEntry(entry: unknown): { text: string; repaired: boolean } | null`:
- `string` → return it unchanged.
- A plain object with exactly one key whose value is a string, number, boolean, or null → return `` `${key}: ${value ?? ""}`.trimEnd() `` with `repaired: true`. This rebuilds the original plain scalar exactly, because YAML split it at the first `": "`.
- Anything else (arrays, nested mappings, multi-key objects) → leave it as is (`null`). It's not something LV can confidently reinterpret, and it wasn't produced by LV.

Both merge branches map their list through this helper before any matching, replacing a recovered item with its string. Because the list is then dumped by js-yaml, which quotes or folds strings as needed, the rewritten item is a valid string scalar.

*Alternative considered*: delete any non-string item. This is simpler and is exactly what the ticket's manual fix does. It's rejected because it would silently delete an engineer's own unquoted guidance, which hits the same YAML pitfall.

*Alternative considered*: a raw-text regex fix on the file (quote the offending line) to keep comments. It's rejected because the affected files already have active `operations:` keys, and once repaired the next merge goes through the YAML round-trip anyway. Line-level regex over folded multi-line items is also fragile.

### D2: Remove the legacy entry when the current wording already exists
Today's flow is `if (guidance.some(matches(text))) continue;`, which runs before the legacy check. With a repaired legacy item plus an existing current item (the ticket's case), that `continue` would leave a now-valid but duplicate legacy item behind. The new order is:
1. Coerce all entries (mark `changed` if any were repaired).
2. If the current `text` is present, filter out every entry matching `legacy`.
3. Otherwise, if a `legacy` entry exists, replace the first one in place and drop any further legacy copies.
4. Otherwise, append `text`.

This also covers the existing "legacy + current wording both present" duplicate, which the current code doesn't remove either. That's consistent with the existing "exactly one copy" requirement.

### D3: Notify via `printWarn`
When any entry was repaired, print one `printWarn` line from the merge branch naming `openspec/config.yaml` and the affected list(s) (e.g. `operations.archive.guidance`), and saying the list was repaired because OpenSpec would otherwise ignore it. This uses the existing helper in `src/cli/helpers.ts` and adds no new text constant to `prompts.ts`, since it's a CLI status message, not prompt/instructional text.

### D4: Share the helper between operations and rules
`addArtifactRules()` uses the same helper for symmetry. It costs nothing, and it protects hand-written rules from being silently stringified to `"[object Object]"`-mismatched duplicates.

## Risks / Trade-offs

- [A one-key mapping item that was *intentionally* a mapping gets turned into a string] → OpenSpec's schema only accepts strings in these lists, so a mapping there is already invalid and ignored. Turning it into a string can only make the list valid.
- [Recovered text differs slightly from the original if the value was folded across lines] → Matching uses `normalizeWhitespace`, so the legacy match still works. For non-LV text, only whitespace layout can differ, and its meaning is kept.
- [Comments in `openspec/config.yaml` are lost on the repair rewrite] → Same as any existing merge-branch write. Documented, not new.

## Migration Plan

No data migration. Affected users either upgrade `lv` and re-run `lv init` (automatic repair), or apply the ticket's manual fix (delete the malformed item). Rollback is reverting the commit. Configs that were already repaired stay valid under the old code too, since it treats them as plain strings.
