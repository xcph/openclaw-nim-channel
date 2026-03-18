## ADDED Requirements

### Requirement: Conversation Display Name
The NIM plugin SHALL set a human-readable `ConversationLabel` for each inbound message context, following the format:
- P2P (单聊): `云信·单聊·{用户昵称}`
- Team (群聊): `云信·群聊·{群名}`
- QChat (圈组): `云信·圈组·{频道名称}`

#### Scenario: P2P conversation label
- **WHEN** a P2P message is received from user with nickname "张三"
- **THEN** `ConversationLabel` is set to `云信·单聊·张三`

#### Scenario: Team conversation label
- **WHEN** a team message is received in group named "产品讨论组"
- **THEN** `ConversationLabel` is set to `云信·群聊·产品讨论组`

#### Scenario: QChat conversation label
- **WHEN** a QChat message is received in channel named "技术频道"
- **THEN** `ConversationLabel` is set to `云信·圈组·技术频道`

### Requirement: User Display Name
The NIM plugin SHALL use the user's nickname as `SenderName` in the inbound context. When the nickname is not available, it SHALL fall back to the user's accid.

#### Scenario: Nickname available
- **WHEN** a message is received from user "user123" who has nickname "张三"
- **THEN** `SenderName` is set to `张三`

#### Scenario: Nickname unavailable
- **WHEN** a message is received from user "user123" who has no nickname
- **THEN** `SenderName` is set to `user123`

### Requirement: Name Resolution with Cache
The NIM plugin SHALL resolve user nicknames, team names, and QChat channel names through SDK APIs with an in-memory cache to minimize API calls.

#### Scenario: Cached name resolution
- **WHEN** a user nickname was queried within the cache TTL period
- **THEN** the cached nickname is returned without an additional API call

#### Scenario: Name resolution failure fallback
- **WHEN** the SDK API call to resolve a name fails (e.g., network error)
- **THEN** the original ID (accid, teamId, or channelId) is used as fallback
- **AND** the error is logged

## MODIFIED Requirements

### Requirement: Message Reception
The NIM plugin SHALL receive and process incoming direct messages from the NIM server.

#### Scenario: Text message received
- **WHEN** a text message is received from a user
- **THEN** the message content is extracted
- **AND** the message is dispatched to the configured agent
- **AND** the sender's nickname is resolved for display

#### Scenario: Image message received
- **WHEN** an image message is received
- **THEN** the image is downloaded to temporary storage
- **AND** the media path is included in the inbound context

#### Scenario: File message received
- **WHEN** a file message is received
- **THEN** the file is downloaded (up to the configured size limit)
- **AND** the file path is included in the inbound context

#### Scenario: Audio/Video message received
- **WHEN** an audio or video message is received
- **THEN** the media is downloaded to temporary storage
- **AND** the media path and type are included in the inbound context
