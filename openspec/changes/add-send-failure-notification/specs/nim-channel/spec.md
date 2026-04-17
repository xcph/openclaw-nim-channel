## ADDED Requirements

### Requirement: Send Failure Notification

The NIM plugin SHALL automatically send a failure notification message to the original recipient when message sending fails.

#### Scenario: Message send fails with error code

- **WHEN** a message send operation fails with an error code
- **THEN** the plugin SHALL send a notification message to the original recipient
- **AND** the notification message content SHALL be formatted as `消息发送失败：<error_description>(<error_code>)`
- **AND** if the notification message also fails to send, no further retry SHALL be attempted

#### Scenario: SDK error description

- **GIVEN** a message send operation fails
- **WHEN** `@yxim/nim-bot` SDK provides an error description (via `error.message` or `error.desc`)
- **THEN** the notification SHALL use the SDK-provided description
- **AND** the error code SHALL be appended in parentheses

#### Scenario: No error description provided

- **GIVEN** a message send operation fails
- **WHEN** the SDK does not provide an error description
- **THEN** the notification SHALL use "发送失败" as the generic description
- **AND** the error code SHALL be appended in parentheses

#### Scenario: Retry prevention for notification message

- **GIVEN** a notification message is being sent due to an original message failure
- **WHEN** the notification message itself fails to send
- **THEN** the plugin SHALL NOT attempt to send another notification
- **AND** the failure SHALL only be logged

### Requirement: Error Description Source

The NIM plugin SHALL use the error descriptions provided by `@yxim/nim-bot` SDK as the authoritative source.

#### Scenario: SDK as single source of truth

- **GIVEN** error information is needed for user notification
- **WHEN** the SDK provides error details via the error object
- **THEN** the plugin SHALL use `error.message` or `error.desc` directly
- **AND** no local error code mapping SHALL be maintained
- **AND** this ensures error messages stay aligned with SDK behavior across versions
