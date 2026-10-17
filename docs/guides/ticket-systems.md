# Ticket systems

Lark Base is the only ticket system LV supports out of the box today, but LV isn't tied to it. `lv start` reaches tickets only through a small `TicketSource` interface ([`src/integrations/tickets/types.ts`](../../src/integrations/tickets/types.ts)):

- fetch a ticket (title, description, feature IDs, UI design references)
- download its attachments
- write feature IDs and status back to the ticket
- create sub-tickets when a big task is split

Supporting Jira, Linear, GitHub Issues, or an in-house tracker means implementing that interface. The rest of the workflow (branching, `state.yaml`, OpenSpec, doc sync) stays the same. Choosing the source through `.lv.yaml` isn't wired up yet (`lv start` always uses Lark), so a new integration adds that setting too.

Want LV with your ticket system? [Open an issue or a pull request](https://github.com/dragonlong206/lv-engineering-crew/issues). In the meantime, `lv start --description "..."` works with any tracker: paste the ticket's text and go.
