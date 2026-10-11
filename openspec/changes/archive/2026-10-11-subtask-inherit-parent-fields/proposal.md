## Why

When `lv start` splits a ticket into sub-tasks, `createSubticket()` writes only the title, description and parent link. The sub-tickets land in Lark with no features, assignee, order or project, so the engineer must fill them in by hand before each `lv start <sub-ticket-id>` — and a sub-ticket with no feature or project loses the context its parent already had.

## What Changes

- When creating sub-tickets, copy these fields from the parent ticket onto each sub-ticket record: features (`lark.feature_id_field`), project (`lark.project_field`), assignee, and order.
- Add two optional config keys under `lark:` — `assignee_field` and `order_field` — naming the columns for assignee and order. Unset skips inheriting that field (no sensible default exists for either column name).
- Feature and project are always inherited, using the existing configured field names. Link-typed columns are written as the parent's linked record IDs; a plain-text feature column is copied as text.
- Assignee and order values are copied from the parent's raw field value as-is.
- Inheritance is best-effort: a parent field that is empty is skipped, and a field the parent lacks never blocks sub-ticket creation.

## Capabilities

### New Capabilities

### Modified Capabilities
- `lv-start/task-splitting`: the "Confirmed split creates linked sub-task records" requirement now also requires each sub-task to inherit the parent's features, project, assignee and order.

## Impact

- `src/tools/lark.ts`: `createSubticket()` accepts the inherited field values; new helper builds them from the parent's `rawFields`.
- `src/integrations/tickets/lark-ticket-source.ts`: `createSubtickets()` passes the parent's inherited fields.
- `src/types.ts`: `LarkConfigSchema` gains `assignee_field` and `order_field`.
- Docs: `docs/features/lv-start/`.
- Requires the app's tenant token to carry Bitable write scope (already needed for sub-ticket creation); no new dependencies.
