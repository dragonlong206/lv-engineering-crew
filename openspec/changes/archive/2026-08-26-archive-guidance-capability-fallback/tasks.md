## 1. Update the guidance text

- [x] 1.1 In `src/prompts.ts`, update `ARCHIVE_GUIDANCE` to describe the capability-path fallback: use recorded feature IDs when present; otherwise, for each delta spec capability path, treat its leading segment as a feature ID and refresh it if a matching `docs/features/<id>/` directory exists.
- [x] 1.2 In `openspec/config.yaml`, replace the existing `operations.archive.guidance` bullet with the updated text (manual edit, not a fresh `lv init` run — see design.md).

## 2. Verification

- [x] 2.1 Run `npx tsc --noEmit` to confirm `src/prompts.ts` still type-checks.
- [x] 2.2 Confirm `openspec/config.yaml`'s `operations.archive.guidance` has exactly one entry (no stale duplicate) and its text matches the new `ARCHIVE_GUIDANCE` constant exactly.
