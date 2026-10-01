## ADDED Requirements

### Requirement: Malformed previously-installed guidance is repaired
The system SHALL repair malformed guidance when the step that configures the archive guidance runs on a project whose OpenSpec configuration has a guidance item written in a form OpenSpec rejects. The case covered is an item intended as text but stored so that it is read as a key/value pair rather than a string. The repair SHALL recover the text that item was meant to hold, and SHALL leave the configuration so that OpenSpec accepts the whole guidance list without a warning. Specifically:
- If the recovered text is an earlier version of LV's archive guidance wording, the system SHALL replace it with the current wording, or remove it if the current wording is already present, so exactly one copy of the current wording remains.
- If the recovered text is not LV's wording, the system SHALL keep it as a valid text item instead of discarding it.

The system SHALL tell the engineer when it has made such a repair.

#### Scenario: Only a malformed legacy item is present
- **WHEN** the configuring step runs on a project whose archive guidance holds a single malformed item carrying an earlier version of LV's wording
- **THEN** the archive guidance ends up holding exactly one valid item with the current wording, and nothing of the malformed item remains

#### Scenario: Malformed legacy item alongside the current wording
- **WHEN** the configuring step runs on a project whose archive guidance holds a malformed item carrying an earlier version of LV's wording, plus a valid item already carrying the current wording
- **THEN** the archive guidance ends up holding exactly one valid item with the current wording, and the malformed item is removed

#### Scenario: Repaired guidance is accepted by OpenSpec
- **WHEN** an engineer requests archive instructions for a change after the configuring step has repaired the project's archive guidance
- **THEN** OpenSpec returns the archive guidance with LV's current wording and reports no warning about the guidance being invalid or discarded

#### Scenario: Malformed item that is not LV's wording
- **WHEN** the configuring step runs on a project whose archive guidance holds a malformed item whose recovered text is not any version of LV's wording
- **THEN** that text is kept as a valid guidance item, and LV's current wording is added alongside it exactly once

#### Scenario: Engineer is told about the repair
- **WHEN** the configuring step repairs one or more malformed guidance items
- **THEN** the engineer sees a notice that the OpenSpec configuration's guidance was repaired

#### Scenario: Nothing malformed
- **WHEN** the configuring step runs on a project whose archive guidance has only valid text items
- **THEN** no repair notice is shown, and the existing idempotency and wording-upgrade behavior applies unchanged
