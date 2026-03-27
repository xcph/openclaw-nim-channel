## ADDED Requirements

### Requirement: QChat Streaming and Chunking Disabled

The NIM plugin SHALL disable block streaming and text chunking for QChat (圈组) messages, regardless of global `blockStreaming` and `textChunkLimit` configuration, ensuring replies are delivered as single complete messages.

#### Scenario: QChat message with global streaming enabled

- **WHEN** global `blockStreaming` is enabled (`blockStreamingDefault: "on"`)
- **AND** a QChat message with @-mention is received
- **THEN** the bot reply is delivered as a single complete message
- **AND** no partial streaming chunks are sent

#### Scenario: P2P and Team streaming unaffected

- **WHEN** global `blockStreaming` is enabled
- **AND** a P2P (私聊) or Team (群组) message is received
- **THEN** the bot reply follows the configured streaming behavior
- **AND** may deliver partial chunks according to `blockStreamingBreak` setting

#### Scenario: QChat streaming override logged

- **WHEN** a QChat message is being processed
- **THEN** the system logs that streaming is disabled for QChat
- **AND** the log message includes `[qchat] streaming disabled for QChat`
