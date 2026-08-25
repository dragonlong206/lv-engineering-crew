# LV Crew - Requirements Document

|         |                        |
| ------- | ---------------------- |
| Version | 0.1                    |
| Status  | Draft, pending review  |
| Scope   | Entire system, 7 steps |

---

## 1. Goals

LV Crew (LV for short) is an AI agent system that supports software development using a spec-driven development model, with engineer involvement at every step.

The problem to solve isn't "writing code faster." The problem is that most of a ticket's time is spent recovering context: rereading old code, asking the ticket author again, guessing how this feature was originally designed. That context lives in people's heads, in chat, in old ticket comments, and fades over time.

LV solves this by forcing context to be written down, stored in git, and updated with every change. Automating the steps is a consequence, not the main goal. If the documentation is good enough, an agent can implement from it — and it makes life easier for humans too.

### Three expected outcomes

1. Every feature has a description document that always reflects the current state of the code
2. Every change has its own analysis and design documents, kept as history
3. The repetitive steps in the process are mostly done by the agent; the engineer shifts from writing to reviewing

### Non-goals

- Replacing the engineer
- Removing human review
- Running automatically from ticket to production without anyone approving

---

## 2. Users and roles

| Role          | Interaction with LV                                                             |
| ------------- | --------------------------------------------------------------------------------- |
| Engineer      | Runs LV, answers questions, approves analysis and design documents, reviews code |
| Test engineer | Approves test scenarios, test cases, automation scripts                          |
| Tech lead     | Approves merge requests, approves feature documentation updates                  |
| Product owner | No direct interaction. Reads feature documentation as needed                     |

LV runs locally on the engineer's machine. No shared server, no centralized dashboard in the current scope.

---

## 3. Overall process

Seven steps; each step must be approved before the next one runs.

| Step | Content                                                          | Output                     | Who approves  |
| ---- | ----------------------------------------------------------------- | --------------------------- | ------------- |
| 1    | Analyze requirements from the ticket, ask clarifying questions   | `1.proposal.md`            | Engineer      |
| 2    | Engineer answers, agent updates, repeat until finalized          | `1.proposal.md` final version | Engineer   |
| 3    | Design the solution                                                | `3.design.md`, `5.tasks.md`, `2.specs/*.md` | Engineer      |
| 4    | Implement the code                                                 | Code on branch               | Engineer      |
| 5    | Review code, update feature documentation, create merge request  | Diff + docs update (reconciled via `lv archive-change-docs`) | Tech lead     |
| 6    | Design test scenarios, test cases, generate automation script    | `4.test-plan.md` + script    | Test engineer |
| 7    | Run automation tests, report results                               | Test report                   | Passing result |

If step 7 fails, go back to step 4. A failing test means either the code or the test is wrong — fix the implementation and review again from the start.

### Two kinds of approval gates

These need to be clearly distinguished because the technical mechanism differs:

- **Self-confirmation** (steps 1 to 4): the engineer reads, edits, and confirms on their own machine. The only constraint is that LV refuses to run step N+1 if step N's artifact hasn't been committed. Acceptable because these steps only produce documents and don't touch the main codebase yet.
- **Approval by someone else** (step 5 onward): merge request approval on GitLab. This is the real gate.

Don't turn steps 1 through 4 into peer review from the start. It would create a lot of friction without any benefit in the early stage.

---

## 4. Documentation requirements

This is the core of the system. Every step reads from and writes to this structure.

### 4.1 Directory structure

```
docs/
  features/
    INDEX.md                    # feature list, maps feature-id -> name, code path
    <feature-id>/
      overview.md               # living document, reflects current state
      design.md                 # architecture, data model, API contract
      requirements.md           # structured Requirement/Scenario source of truth (see 4.2a)
      history.md                # index of changes that touched this feature
  changes/
    <ticket-id>/
      1.proposal.md              # why/what/scope, open questions (analysis step)
      2.specs/                    # delta requirements, one file per touched feature
        <feature-id>.md
      3.design.md                 # approach, data model, API changes, testing (design step)
      4.test-plan.md               # test scenarios/cases proving the change works (step 6)
      5.tasks.md                    # implementation checklist (design step)
      state.yaml
```

Numeric prefixes on the change-folder files reflect the order the flow produces/reconciles
them: proposal, then specs deltas, then design, then test plan, then tasks. `state.yaml` stays
unprefixed since it's metadata, not a flow artifact.

### 4.2 Feature documentation

**Purpose:** context for subsequent changes and bug fixes.

Requirements:

- Always reflects the current state of the code, not history
- Updated at step 5, once the code diff exists. Not updated at step 1 or 3, since at that point it isn't yet known exactly how the feature will change
- For `overview.md`/`design.md` (prose, not requirement-keyed), the agent **may only make deliberate edits**: add a section, remove a section, edit a section. Never rewrite the whole file
- For `requirements.md`, reconciling a change's delta is a **mechanical merge** instead (see 4.2a): ADDED requirements are appended, MODIFIED requirements replace the matched header's block, REMOVED requirements are deleted by matched header. No freeform rewriting there either, but the mechanism is header-matching rather than agent judgment
- The documentation update lives in the same merge request as the code, approved at the same time

The reason for the section-only-edit / mechanical-merge rule: with multiple tickets running in parallel on the same feature, rewriting the whole file causes markdown merge conflicts and produces a diff so large that reviewers rubber-stamp it without reading. The second problem is more dangerous, because it silently degrades the quality of context for later tickets.

When `overview.md` exceeds roughly 400 lines, split the content into sub-files in the same directory and turn `overview.md` into an index.

### 4.2a Requirement/scenario format

`requirements.md` and change delta files (`docs/changes/<ticket-id>/2.specs/<feature-id>.md`)
share one convention, borrowed from [OpenSpec](https://github.com/Fission-AI/OpenSpec):

- `requirements.md` holds `### Requirement: <Name>` blocks. Name is descriptive, under ~50
  characters, and unique within the file after trimming whitespace (case-sensitive match). Each
  requirement opens with a SHALL statement describing the core behavior
- Under each requirement, one or more `#### Scenario: <situation>` blocks give concrete,
  testable examples as bullets: `**WHEN**` (trigger), `**THEN**` (outcome), optional
  `**GIVEN**` (initial state) and `**AND**` (additional condition/outcome)
- `requirements.md` states externally observable behavior only — inputs, outputs, constraints.
  Implementation detail (library choices, function/class structure, execution mechanics) stays
  in `design.md`, keeping the existing "what" (`requirements.md`) vs "how" (`design.md`) split
- A change's `docs/changes/<ticket-id>/2.specs/<feature-id>.md` delta file proposes edits
  against a feature's `requirements.md` using `## ADDED Requirements` / `## MODIFIED
  Requirements` / `## REMOVED Requirements` sections, matching requirement headers verbatim
  against the target file

### 4.3 Change documentation

**Purpose:** for review, keeping history, and as the basis for implementation and testing.

Requirements:

- Each ticket gets its own directory under `docs/changes/<ticket-id>/`
- Stored on branch `lv/<ticket-id>`, merged into the main branch together with the code
- Not edited after merging. Any change means a new ticket
- A ticket's `2.specs/<feature-id>.md` delta is *proposed* at step 3 (design), alongside
  `3.design.md`/`5.tasks.md`, but not *reconciled* into the feature's `requirements.md` until
  step 5 once the code diff exists — same timing rule as `overview.md`/`design.md`

### 4.4 Feature granularity

For a project with around 8 developers, the target is 10 to 20 features.

Practical criterion: a feature is something the product owner can talk about as an independent unit, and it usually corresponds to a group of screens or a group of APIs.

Two common failure modes:

- Too small, one feature per screen: fragmented documentation, a single ticket touches 5 features, updating becomes a burden
- Too large, one feature per module: `overview.md` balloons to several thousand lines, loading it as context burns tokens and the agent still can't find the relevant part

### 4.5 Bootstrapping an existing project

When applying LV to an existing project, the `docs/features/` directory starts empty. Don't backfill everything, since most of the documentation written that way would never be used.

The approach: lazy bootstrapping. When the first ticket touches a feature with no docs yet, the engineer runs the bootstrap command, points it at the code paths, and LV generates a draft. The engineer reads and edits it, usually taking 15 to 30 minutes. The ticket then proceeds normally.

The draft must have a header clearly marking it as auto-generated and unconfirmed. LV does not guess code paths on its own — the engineer must point them out.

---

## 5. Ticket and feature ID requirements

- Tickets are fetched from the task management system via API. The pilot uses Lark Base; the design must stay open to Jira
- Feature ID is a dedicated column in the task system, not free text in the description
- If a ticket has no feature ID, LV **reports an error and stops**. It does not guess
- A ticket can have multiple feature IDs. The agent must spell out the impact on each feature
- If a feature ID points to a directory that doesn't exist, report an error and suggest running bootstrap

### Sanity checks

Two points in time, two different questions:

- **At the start**, only the ticket description is available. The question that can be answered is "does this ticket actually belong to the declared feature." If the description talks about payments but the feature ID points to onboarding, warn and stop
- **After implementation**, the code diff exists. The stronger question is "does the actual change fall within this feature's scope, and is the feature documentation still accurate after this change." This is where documentation drift gets caught, and it must be a mandatory part of step 5

---

## 6. State and storage requirements

### Principle: git is the single source of truth

State and artifacts must change together in the same commit. If state lives somewhere else (a DB, Notion) while the documents live in git, there will eventually be a moment where the state says "step 1 approved" but the file on the branch is still the old version, with no way to know which one is right.

Side benefits:

- State travels with the branch. Anyone who checks out `lv/<ticket-id>` can pick up right where it left off, no extra configuration needed
- No extra auth needed on each engineer's machine
- State history is already in the git log — no need to build a separate audit trail

### State contents

`docs/changes/<ticket-id>/state.yaml` records what git doesn't know:

```yaml
ticket_id: PROJ-1234
feature_ids:
  - checkout-flow
branch: lv/PROJ-1234
current_step: design
steps:
  analysis:
    status: approved # pending | in_progress | approved
    iterations: 3
    model: <model name>
    tokens_in: 45120
    tokens_out: 8300
    duration_seconds: 142
    approved_at: 2026-08-24T10:15:00+07:00
  design:
    status: in_progress
    iterations: 1
created_at: 2026-08-24T09:02:00+07:00
lv_version: 0.1.0
```

For steps with a merge request, GitLab approval is the source of truth for "approved or not." If state and GitLab disagree, trust GitLab.

### Mirror for visibility

A read-only mirror (e.g. to Notion) can be generated to get an overview of tickets in flight. If the mirror is wrong, just regenerate it — it doesn't affect the workflow. Not required; add it later once there's a need to answer questions about volume and cost.

---

## 7. Model configuration requirements

- Each step can use a different model, configurable via a config file in the repo
- The model used must be recorded in state at every step, even before per-step configuration is allowed
- Input tokens, output tokens, and run duration must be recorded per step

Per-step model configuration only becomes meaningful once there's real data on which steps need a stronger model and which don't. So the logging requirement takes priority over the configuration requirement.

---

## 8. Command-line interface requirements

LV is a CLI tool that runs locally.

| Command                                       | Function                                              |
| ---------------------------------------------- | ------------------------------------------------------ |
| `lv bootstrap <feature-id> --paths <paths>`   | Generate a draft feature document from existing code   |
| `lv start <ticket-id>`                        | Start a ticket, create a branch, generate the analysis document |
| `lv answer`                                    | Engineer answers questions, agent updates the document |
| `lv approve`                                   | Finalize the current step, move to the next one        |
| `lv next`                                      | Run the next step according to state                   |
| `lv status`                                    | View the current status                                |
| `lv archive-change-docs <ticket-id>`           | Mechanically merge the ticket's `2.specs/*.md` deltas into each affected feature's `requirements.md` (ADDED → append, MODIFIED → replace matched header, REMOVED → delete matched header). Not yet implemented — noted here for step 5 (see §10) |

`approve` is deliberately separate from `next`. Finalizing a step must be an explicit action by the engineer, not a side effect of moving forward.

`archive-change-docs` is named deliberately unlike OpenSpec's `archive`: it reconciles
*content* into `requirements.md` only. It does not move or rename
`docs/changes/<ticket-id>/` — that directory stays exactly where it is, per the "not edited
after merging" rule in §4.3. It also covers only the doc-reconciliation slice of step 5;
code review and merge-request creation stay manual/GitLab-side.

---

## 9. Non-functional requirements

### Extensibility per step

Each step consists of exactly three components: a context loader (what to load, from where), a prompt template, and an output contract (which file to write, in what format). As long as these three stay well-defined, adding a new step means adding a config directory, not modifying the engine.

The engine only knows what the current step is, whether it's finalized, and what the next step is. The engine doesn't know the content of the documents.

### Ability to switch LLM providers

Minimal interface: takes messages and a model name, returns text. Don't prematurely abstract tool calling or streaming.

### Quality of generated documentation

Documentation generated by the agent is read by engineers every day, so:

- Write concisely, no flowery language
- Don't use em dashes for parenthetical remarks
- Questions asked must be genuinely necessary. If the information already exists in the feature documentation, don't ask again
- Every question must state why it needs to be answered, so the engineer knows what the answer affects

### Security

- Do not run LV on client codebases until there's confirmation on AI tooling usage policy, IP concerns, and data residency
- The pilot runs on an internal product

---

## 10. Roadmap

### Phase 1: steps 1 to 3

The goal is to validate the documentation structure and context quality, not to save time.

Scope: read tickets from Lark Base, generate and update `1.proposal.md` and `3.design.md`/`5.tasks.md`/`2.specs/*.md`, bootstrap feature documentation, manage state in git, local git operations.

Out of scope for this phase: GitLab API integration (the engineer creates the merge request manually), writing status back to Lark Base, per-step model configuration, sanity checks between ticket and feature.

Phase 1 code covers *proposing* requirement deltas during `lv design` (writing
`2.specs/<feature-id>.md`) and generating the initial `requirements.md` via bootstrap/init. It
does not cover *reconciling* those deltas — that's `lv archive-change-docs` (§8), step-5 work
for a later phase, not implemented yet.

### Phase 2: steps 4 and 5

Implementation and review. This is when the feature documentation update starts working, and when real GitLab API integration is needed.

### Phase 3: steps 6 and 7

Testing. Left for last because it depends heavily on environment, CI, and test data. This is the part most likely to bog down.

---

## 11. Evaluation criteria

### The deciding question

**Is the design document LV writes good enough for a different developer to implement without having to ask the ticket author again?**

How to test: after `3.design.md` is finalized, hand it to a developer who wasn't involved in that ticket and have them implement it. Count how many times they have to come back and ask.

- 0 to 1: the documentation is good enough to automate step 4
- 3 or more: the design template or context loader needs fixing before doing anything else

### Metrics to track

Record these in state from the very first ticket. Collecting them later means no historical data.

- Number of back-and-forth rounds until each step is finalized
- Number of lines the engineer hand-edits compared to what the agent generated
- Tokens and duration per step
- Time from starting a ticket to merging it

After about 10 tickets, if the number of iterations isn't trending down, the cause is almost always context, not prompt or model.

---

## 12. Identified risks

| Risk                                                     | Impact | Mitigation                                                                                             |
| ----------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| Feature documentation grows too large, loses its usefulness as context | High   | For `requirements.md`, delta specs make reconciliation a small mechanical merge instead of a full rewrite (§4.2a); for `overview.md`/`design.md`, enforce section-only edits, split files past the threshold, measure tokens loaded |
| Engineer rubber-stamps because the diff is too large       | High   | Limit documentation diff size, warn in CI past the threshold                                              |
| Token cost exceeds expectations                             | Medium | Log tokens from the start, optimize the context loader based on real data                                  |
| Team feels like it's extra work                             | Medium | Be upfront from the start: you're not writing more documentation, but you do have to read and edit more. In exchange, later tickets come with context already in place |
| Feature documentation drifts from the code over time         | High   | Sanity-check at step 5 based on the code diff                                                              |

---

## 13. Open questions

- Language and runtime for the tool
- Auth mechanism with Lark Base: a personal token per engineer or a shared app token. Affects configuration across multiple machines and auditing who ran LV on which ticket
- Name of the feature ID column in Lark Base
- Default branch of the target repo
- How to handle two tickets editing the same section of `overview.md`
- Specific threshold for CI to warn about an overly large documentation diff
- Format for resolving two changes that propose conflicting deltas to the same requirement header before either is reconciled (OpenSpec doesn't fully solve this either)
