## 1. Config

- [x] 1.1 Add optional `assignee_field` and `order_field` to `LarkConfigSchema` in `src/types.ts`, with comments matching the neighboring fields

## 2. Inheritance logic

- [x] 2.1 Add `buildInheritedFields(parent, config.lark)` to `src/tools/lark.ts` converting the parent's `rawFields` for features, project, assignee and order per Decision 2, omitting empty values
- [x] 2.2 Extend `createSubticket()` to accept the inherited fields and merge them into the POST body
- [x] 2.3 Update `createSubtickets()` in `src/integrations/tickets/lark-ticket-source.ts` to build and pass the inherited fields, and retry once without them (with a warning naming the skipped fields) if creation fails
- [x] 2.4 Update the `createSubtickets` doc comment in `src/integrations/tickets/types.ts` to mention inheritance

## 3. Verification

- [x] 3.1 Run `npx tsc --noEmit` and `npm run build`
- [x] 3.2 Scripted check of `buildInheritedFields()` with a fixture parent, covering: sub-task inherits features and project (link and text feature columns); sub-task inherits assignee and order; unset `assignee_field`/`order_field` or empty parent values leave fields unset
- [x] 3.3 Manual check of the "One sub-task fails to create" and fallback-retry scenarios against a scratch Lark Base (or by stubbing `fetch`)

## 4. Docs

- [x] 4.1 Update `docs/features/lv-start/` and the `.lv.yaml` config reference to describe `assignee_field`/`order_field` and the inheritance behavior
