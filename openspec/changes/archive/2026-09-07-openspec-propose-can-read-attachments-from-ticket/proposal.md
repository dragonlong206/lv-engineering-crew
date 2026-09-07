## Why

A Lark ticket's "Attachment" field can carry documents, screenshots, or videos that describe the change in more detail than the title/description alone. Today `fetchTicket()` never reads that column at all, so those files never reach `state.yaml`, and whoever runs `/opsx:propose` has to go open the ticket in Lark by hand to see them — easy to forget, and the generated `proposal.md` never reflects what's actually attached. Unlike a UI design reference (a link `lv-start/ui-design-capture` already captures and leaves for the OpenSpec workflow to fetch), an attachment is a binary file behind Lark's authenticated Drive API — no downstream tool the workflow has access to (`WebFetch`, a browser) can retrieve it without the same tenant token `lv` already holds during `lv start`. So the file has to be downloaded by `lv` itself, not just referenced.

## What Changes

- Add a new optional `.lv.yaml` field, `lark.attachment_field`, naming the Lark Base column that holds a ticket's attachment(s) (a Lark attachment-type field: one or more uploaded files).
- `fetchTicket()` reads that column (when configured) and extracts each attached file's `file_token` and `name` onto the returned `LarkTicket`. No download happens inside `fetchTicket()` itself — it stays a metadata-only read, consistent with how it already handles every other field.
- `lv start` downloads each attachment (when present) via Lark's Drive media-download API into `docs/changes/<change-id>/attachments/`, using the tenant token already obtained for the ticket fetch. A download failure is non-fatal (printed as a warning, matching `sync_status`/`sync_feature_id`'s posture) and does not block the rest of `lv start`.
- `lv start` persists the downloaded files' repo-relative paths into a new optional `attachments` field on `docs/changes/<change-id>/state.yaml`, alongside `title`/`description`/`ui_design`. Omitted (not `[]`) when there's nothing to record.
- Extend `lv init`'s existing propose-specific patch mechanism — a new `PROPOSE_ATTACHMENT_LINE` (`src/prompts.ts`) applied by a new `addProposeAttachmentInstruction()` (`src/cli/init.ts`), alongside the existing `PROPOSE_STATE_AUTOLOAD_LINE`/`PROPOSE_LINK_CHANGE_LINE`/`PROPOSE_UI_DESIGN_LINE` patches into the generated `/opsx:propose` workflow file(s) — so that, specifically when creating the `proposal` artifact, the workflow is instructed to read each downloaded attachment (already a local file, no fetch needed) and reflect what it observes in `proposal.md`'s "What Changes"/"Impact" sections, falling back to citing the file's name/path when its format can't be read directly (e.g. a video). This is the "update OpenSpec propose skill to read these files for context" half of the request. Deliberately scoped to `/opsx:propose` only, mirroring `PROPOSE_UI_DESIGN_LINE`'s reasoning: `/opsx:apply`/`/opsx:sync`/`/opsx:archive` produce nothing this instruction is about.

## Capabilities

### New Capabilities
- `lv-start/attachment-capture`: downloading a ticket's attachment field (documents, screenshots, videos) from a configured Lark field into `docs/changes/<change-id>/attachments/` and recording the downloaded paths in `state.yaml`.

### Modified Capabilities
- `lv-init/openspec-bootstrap`: gains a new requirement (an ADDED requirement in the delta spec) — patching the generated `/opsx:propose` workflow file(s) to read a change's downloaded attachments when creating the `proposal` artifact. Existing requirements (feature docs / ticket-description context load / UI design analysis) are untouched.

## Impact

- `src/types.ts`: `LarkConfigSchema` gains `attachment_field` (optional, no default); `StateSchema` gains `attachments` (optional array of repo-relative path strings).
- `src/tools/lark.ts`: `LarkTicket` gains `attachments: { fileToken: string; name: string }[]`; `fetchTicket()` extracts the configured field; a new `downloadTicketAttachments()` (or similar) performs the actual Drive-API download and file write, called from `lv start` rather than from `fetchTicket()`.
- `src/cli/start.ts`: calls the download step (ticket-based start only) and sets `state.attachments` from the resulting relative paths when non-empty.
- `src/prompts.ts`: new `PROPOSE_ATTACHMENT_LINE` constant.
- `src/cli/init.ts`: new `addProposeAttachmentInstruction()`, patching the generated `/opsx:propose` workflow file(s) (mirroring `addProposeUiDesignInstruction()`), called from `runInit()`.
- `.lv.yaml` (this repo's own, and the template `lv init` documents): new commented-out `attachment_field` example.
- No breaking changes — the field is optional throughout, and its absence preserves current behavior exactly.
