## MODIFIED Requirements

### Requirement: Message Sending
The system SHALL support sending messages through the NIM channel with the following capabilities:
- Text messages up to 5000 characters
- Automatic chunking for long messages
- Support for image, file, audio, and video attachments
- Integration with MoltBot's reply dispatch system through the standard `outbound` interface

#### Scenario: Outbound text message via SDK interface
- **GIVEN** MoltBot has processed an incoming message and generates a reply
- **WHEN** the reply dispatch system calls `outbound.sendText` with target and text
- **THEN** the system SHALL send the text message to the specified NIM account
- **AND** return a result object containing `{ channel: "nim", ok: boolean, msgId?: string, error?: string }`

#### Scenario: Outbound media message via SDK interface
- **GIVEN** MoltBot needs to send a media file in response
- **WHEN** the reply dispatch system calls `outbound.sendMedia` with target, text, and mediaUrl
- **THEN** the system SHALL download the media and send it via NIM
- **AND** return a result object with the same format as text messages

#### Scenario: Target resolution for replies
- **GIVEN** an incoming message from a NIM user
- **WHEN** `outbound.resolveTarget` is called with the sender's info
- **THEN** the system SHALL return a valid NIM account ID
- **AND** handle both explicit targets (nim:xxx, user:xxx) and implicit targets (from allowFrom list)

#### Scenario: Long message auto-splitting
- **WHEN** a message exceeds 5000 characters
- **THEN** the system SHALL split the message into multiple chunks
- **AND** send each chunk sequentially
- **AND** preserve logical breaks (newlines, spaces) when splitting
