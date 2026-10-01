## Why

Projects first wired by an early `lv init` (from `5377e7f`, before `797e2b2` started quoting guidance values) have an `operations.archive.guidance` item written as an unquoted plain scalar. Its text contains `` `lv bootstrap <feature-id>`: use ``, so YAML parses the item as a one-key mapping instead of a string. OpenSpec requires `guidance` to be an array of strings, so it drops the **whole** archive guidance with a warning that's easy to miss — including LV's valid, current-wording item — and `/opsx:archive` never sees the feature-doc refresh instruction.

Re-running today's `lv init` doesn't repair this. Its merge path compares each entry with `String(entry)`, which turns the mapping into `"[object Object]"`. That matches neither the legacy nor the current wording, so the current text is appended next to the broken item, which is dumped back as `` ...`lv bootstrap <feature-id>`: >- ``. The result is the exact two-item, still-broken config reported in the ticket.

## What Changes

- `lv init`, when merging into an existing `operations.<id>.guidance` list, detects items that were meant as strings but parsed as a one-key mapping (an unquoted plain scalar containing `": "`). It turns each one back into the string the author wrote (`"<key>: <value>"`) before comparing.
- A repaired item that matches LV's legacy archive wording is upgraded in place to the current wording. If the current wording is already present, the repaired legacy item is removed, so exactly one copy is left.
- A repaired item that matches no LV wording, such as an engineer's own guidance, is kept as its own (now properly quoted) string rather than dropped.
- The same string recovery applies to `rules.<artifact-id>` lists that `lv init` merges into, for consistency. No LV-written rule was ever unquoted, so this only guards hand-written entries.
- `lv init` prints a short notice when it repairs malformed entries, so the engineer knows `openspec/config.yaml` changed for this reason.
- After the repair, `openspec instructions archive --change <name> --json` returns `operationGuidance` without a parse warning.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `lv-init/feature-doc-freshness`: adds a requirement that `lv init` repair archive guidance an earlier `lv init` wrote in a form OpenSpec rejects, leaving exactly one valid copy in the current wording.

## Impact

- **Code**: `src/cli/init.ts`. This covers `addOperationGuidance()`'s YAML-merge branch, `addArtifactRules()`'s merge branch, and a small shared helper that recovers string entries. `src/prompts.ts` is unchanged (`LEGACY_ARCHIVE_GUIDANCE`/`ARCHIVE_GUIDANCE` are reused as-is).
- **Target repos**: running `lv init` again on an affected project rewrites `openspec/config.yaml` through the existing js-yaml round-trip, which already happens whenever `operations:` is active. The file's template comments are lost on that rewrite, the same as today.
- **Not affected**: the fresh-install append path, which already quotes values via `JSON.stringify`; the `context:` pointer, which is a single string and not a list; and this repo's own `openspec/config.yaml`, which is already valid.
- **Manual workaround (no upgrade needed)**: delete the malformed first item under `operations.archive.guidance`, as described in the ticket.
