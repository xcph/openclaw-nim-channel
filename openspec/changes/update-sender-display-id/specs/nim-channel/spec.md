## MODIFIED Requirements

### Requirement: User Display Name
The NIM plugin SHALL use the user's nickname as `SenderName` in the inbound context. When the nickname is not available, it SHALL fall back to the user's accid.

The plugin SHALL also set `SenderId` to the user's nickname when available, so that the UI does not redundantly display both the nickname and the raw account ID. When no nickname is available, `SenderId` SHALL be set to the user's accid.

#### Scenario: Nickname available — SenderName
- **WHEN** a message is received from user "user123" who has nickname "张三"
- **THEN** `SenderName` is set to `张三`

#### Scenario: Nickname unavailable — SenderName fallback
- **WHEN** a message is received from user "user123" who has no nickname
- **THEN** `SenderName` is set to `user123`

#### Scenario: Nickname available — SenderId uses nickname
- **WHEN** a message is received from user "user123" who has nickname "张三"
- **THEN** `SenderId` is set to `张三`
- **AND** the UI shows only the nickname, not the raw account ID

#### Scenario: Nickname unavailable — SenderId uses accid
- **WHEN** a message is received from user "user123" who has no nickname
- **THEN** `SenderId` is set to `user123`
- **AND** the UI shows the account ID as the display identifier
