## MODIFIED Requirements

### Requirement: Confirmed split creates linked sub-task records in the ticket system
The system SHALL, upon a confirmed split, create one new ticket record per suggested sub-task in the ticket system, populated with that sub-task's title and description, and SHALL record each sub-task's relationship to the parent ticket when a relationship field is configured. Each created sub-task SHALL also inherit the parent ticket's features, project, assignee and order, to the extent the parent has a value for each and the corresponding field is configured.

#### Scenario: Relationship field is configured
- **WHEN** the split is confirmed and `lark.subtask_parent_field` is set
- **THEN** each created sub-task record's relationship field links back to the parent ticket

#### Scenario: Relationship field is not configured
- **WHEN** the split is confirmed and `lark.subtask_parent_field` is unset
- **THEN** the system still creates each sub-task record with its title and description, skips writing any relationship, and warns that the relationship was not recorded

#### Scenario: One sub-task fails to create
- **WHEN** the split is confirmed and creating one of the suggested sub-task records fails
- **THEN** the system reports that failure and continues creating the remaining sub-task records rather than aborting the whole operation

#### Scenario: Sub-task inherits features and project
- **WHEN** the split is confirmed and the parent ticket has values in `lark.feature_id_field` and `lark.project_field`
- **THEN** each created sub-task record has the same feature and project values as the parent

#### Scenario: Sub-task inherits assignee and order
- **WHEN** the split is confirmed, `lark.assignee_field` and `lark.order_field` are set, and the parent ticket has values in them
- **THEN** each created sub-task record has the same assignee and order values as the parent

#### Scenario: Inheritable field not configured or empty on the parent
- **WHEN** the split is confirmed and `lark.assignee_field` or `lark.order_field` is unset, or the parent has no value for an inheritable field
- **THEN** the system leaves that field unset on the sub-task records and still creates them
