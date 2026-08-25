<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

<!-- AUTO-GENERATED — not yet verified. Review and edit before committing. -->

### Requirement: Generate feature docs
`lv-bootstrap` SHALL create overview, design, and requirements documentation for a named feature from code input or repository exploration.

#### Scenario: Generate docs from explicit paths
- **GIVEN** a feature id and one or more valid files or directories
- **WHEN** the user runs `lv bootstrap <feature-id> --paths <paths>`
- **THEN** the command writes `overview.md`, `design.md`, and `requirements.md` under `docs/features/<feature-id>/`

#### Scenario: Generate docs by scanning the repo
- **GIVEN** a feature id and a repository containing code to inspect
- **WHEN** the user runs `lv bootstrap <feature-id>` without `--paths`
- **THEN** the command explores the repository and writes `overview.md`, `design.md`, and `requirements.md` under `docs/features/<feature-id>/`

### Requirement: Preserve existing drafts
`lv-bootstrap` SHALL refine existing feature doc drafts when they already exist in scan mode.

#### Scenario: Refine an existing overview
- **GIVEN** `docs/features/<feature-id>/overview.md` already exists
- **WHEN** the user runs `lv bootstrap <feature-id>` without `--paths`
- **THEN** the command includes the existing draft content in the scan prompt so the new output can update it

#### Scenario: Refine an existing design and requirements doc
- **GIVEN** `docs/features/<feature-id>/design.md` or `requirements.md` already exists
- **WHEN** the user runs `lv bootstrap <feature-id>` without `--paths`
- **THEN** the command includes the existing draft content in the scan prompt so the new output can update it

### Requirement: Maintain the feature index
`lv-bootstrap` SHALL keep `docs/features/INDEX.md` updated with the bootstrapped feature.

#### Scenario: Create a missing index file
- **GIVEN** `docs/features/INDEX.md` does not exist
- **WHEN** `lv bootstrap` finishes successfully
- **THEN** the command creates an index file containing a link to the feature overview

#### Scenario: Avoid duplicate index entries
- **GIVEN** `docs/features/INDEX.md` already contains the feature
- **WHEN** `lv bootstrap` finishes successfully
- **THEN** the command does not add a duplicate entry

### Requirement: Ignore hints with paths
`lv-bootstrap` SHALL ignore `--name` and `--description` when `--paths` is provided.

#### Scenario: Paths and hints are both supplied
- **GIVEN** the user passes `--paths` together with `--name` or `--description`
- **WHEN** the command starts path-based generation
- **THEN** it warns that the hints are ignored and proceeds using only the supplied paths