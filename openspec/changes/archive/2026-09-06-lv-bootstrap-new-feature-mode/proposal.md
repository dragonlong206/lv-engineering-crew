## Why

`lv bootstrap`'s autonomous scan mode assumes the feature already has code to explore. For a feature that hasn't been built yet, this produces fabricated or misleading content instead of useful placeholders, and wastes an LLM exploration pass on a codebase that has nothing relevant to find. `lv start`'s inline bootstrap path hits exactly this case whenever a ticket references a feature with no existing `docs/features/<id>/` directory — that absence *is* the "brand-new feature" signal, but today it still runs the full autonomous scan.

## What Changes

- Add a "new feature" mode to the bootstrap generation logic: instead of scanning the repo (or reading `--paths`), it writes `overview.md` and `design.md` containing only the standard section headings as placeholders for the engineer to fill in, with no code-derived content and no LLM/exploration call.
- Expose this mode on the `lv bootstrap <feature-id>` CLI as a `--new-feature` flag.
- Wire `lv start`'s inline bootstrap path (`docs/features/<feature-id>/` missing) to use new-feature placeholder mode instead of the autonomous scan, since a missing feature directory already means there's nothing to scan.

## Capabilities

### New Capabilities
- `lv-bootstrap/new-feature-placeholder-mode`: `lv bootstrap <feature-id> --new-feature` skips code scanning/exploration entirely and writes placeholder-only `overview.md`/`design.md` for the engineer to fill in.

### Modified Capabilities
- `lv-start/inline-feature-bootstrap`: the "Missing feature directory triggers inline bootstrap" requirement changes from generating docs via autonomous scan to generating placeholder-only docs via the new new-feature mode.

## Impact

- `src/index.ts`: new `--new-feature` option on the `bootstrap` command.
- `src/cli/bootstrap.ts`: new placeholder-generation path in `runBootstrap()`/`runBootstrapFromScan()` (or a sibling function), bypassing `createBootstrapScanAgent()` entirely when new-feature mode is active.
- `src/cli/start.ts`: the inline-bootstrap call site switches from scan mode to new-feature placeholder mode.
- No changes to `--paths` mode, to existing feature refinement (existing docs still get the autonomous scan), or to Lark sync behavior.
