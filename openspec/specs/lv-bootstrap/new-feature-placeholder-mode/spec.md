## Purpose

Lets `lv bootstrap` produce placeholder-only feature docs for a feature that has no code yet, instead of running codebase exploration that has nothing relevant to find and can fabricate misleading content.

## Requirements

### Requirement: New-feature mode skips code scanning
The system SHALL, when invoked in new-feature mode for a feature ID, generate `overview.md` and `design.md` containing only the standard section headings as placeholders, without reading `--paths`, running autonomous codebase exploration, or otherwise deriving content from repository code.

#### Scenario: New-feature mode requested via CLI flag
- **WHEN** `lv bootstrap <feature-id> --new-feature` is run
- **THEN** the system writes `docs/features/<feature-id>/overview.md` and `design.md` containing only placeholder section headings, without scanning the repository or calling an LLM

#### Scenario: New-feature mode ignores --paths
- **WHEN** `lv bootstrap <feature-id> --new-feature` is run together with `--paths`
- **THEN** the system generates placeholder-only docs and does not read the given paths

### Requirement: Placeholder docs are marked auto-generated
The system SHALL prepend the same auto-generated header used by scan/path-based generation to placeholder docs, so they are still flagged for manual review before commit.

#### Scenario: Placeholder docs carry the auto-generated header
- **WHEN** new-feature mode writes `overview.md` and `design.md`
- **THEN** both files start with the standard auto-generated header comment

### Requirement: New-feature mode still updates the feature index
The system SHALL create the feature directory if needed and update `docs/features/INDEX.md` after writing placeholder docs, matching the behavior of scan and path-based generation.

#### Scenario: Feature index gains an entry for a placeholder-only feature
- **WHEN** new-feature mode successfully writes placeholder docs for a feature ID with no existing index entry
- **THEN** `docs/features/INDEX.md` gains a link for that feature, following the same append-only rule as other generation modes
