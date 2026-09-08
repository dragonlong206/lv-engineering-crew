## Purpose

Keeps autonomous-scan feature-doc generation from crashing with an opaque parse-error stack trace when the scan agent's response isn't valid JSON, by retrying once with a corrective nudge before failing cleanly.

## ADDED Requirements

### Requirement: Non-JSON scan response triggers a corrective retry
The system SHALL, when the autonomous-scan agent's response does not contain a parseable JSON object with the required `overviewMarkdown` and `designMarkdown` fields, make one additional request asking the agent to return that JSON, instead of failing on the first response.

#### Scenario: Scan agent responds with narrative text instead of JSON
- **WHEN** the scan agent's response contains no parseable JSON envelope (for example, only narrative text such as "Now let's put together the documentation...")
- **THEN** the system retries once with an explicit request for the required `{"overviewMarkdown":"...","designMarkdown":"..."}` JSON, rather than failing immediately

#### Scenario: Retry succeeds
- **WHEN** the corrective retry's response contains a parseable JSON envelope with `overviewMarkdown` and `designMarkdown`
- **THEN** the system writes `overview.md` and `design.md` from that JSON exactly as it would have from a valid first response

### Requirement: Persistent non-JSON failure produces an actionable CLI error
The system SHALL, when the corrective retry's response also does not contain a parseable JSON envelope, stop with a clear, actionable error describing that the LLM did not return the expected JSON, instead of letting a raw JSON-parsing exception propagate.

#### Scenario: Retry also fails
- **WHEN** the corrective retry's response contains no parseable JSON envelope
- **THEN** the system prints an actionable error message identifying that feature-doc generation failed because the LLM did not return valid JSON, exits non-zero, and does not write partial or corrupt `overview.md`/`design.md` files

#### Scenario: Error message includes what the model actually returned
- **WHEN** the system reports the actionable error described above
- **THEN** the error includes a snippet of the model's actual response text, so the engineer can tell what went wrong instead of seeing only a generic parse-error message

### Requirement: Inline feature bootstrap shares the same recovery behavior
The system SHALL apply the same corrective-retry and actionable-error behavior when `lv start` bootstraps a referenced feature inline via autonomous scanning, since it uses the same scan-generation path as `lv bootstrap`.

#### Scenario: lv start's inline bootstrap hits a non-JSON scan response
- **WHEN** `lv start` triggers inline feature bootstrap for a referenced feature with no existing `docs/features/<feature-id>/` directory, and the scan agent's response is not parseable JSON
- **THEN** the same retry-then-actionable-error behavior applies as when running `lv bootstrap` directly
