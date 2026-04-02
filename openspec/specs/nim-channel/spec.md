# NIM Channel Plugin Specification

## Purpose

Provide an OpenClaw channel plugin that connects to the NetEase NIM IM service, enabling AI bots to send and receive messages via the NIM SDK.
## Requirements
### Requirement: Plugin Registration

The NIM plugin SHALL register as a Clawdbot channel plugin with the channel ID `nim` and package name `openclaw-nim`.

#### Scenario: Plugin loaded by Clawdbot

- **WHEN** Clawdbot loads the NIM plugin
- **THEN** the plugin registers with:
  - Plugin ID: `openclaw-nim`
  - Channel ID: `nim`
  - Display name: `OpenClaw NIM Plugin`
- **AND** the plugin exposes the `nimPlugin` ChannelPlugin implementation

### Requirement: SDK Data Directory

The plugin SHALL store SDK data files in the user's home directory under `~/.openclaw-nim/<account>/`.

#### Scenario: Data directory creation

- **GIVEN** a user configures NIM account `12345`
- **WHEN** the NIM client initializes
- **THEN** SDK data files are stored in `~/.openclaw-nim/12345/`

### Requirement: Channel Configuration

The NIM plugin SHALL accept configuration under `channels.nim` with the following fields:

- **Required** (at least one方式): `nimToken` (shorthand) OR `appKey` + `account` + `token` (individual fields)
- **Optional**: other sub-configurations (p2p, team, qchat, advanced)

The `nimToken` field is a shorthand format: preferred `appKey|accid|token` (three segments separated by `|`), with legacy `appKey-accid-token` remaining valid for backward compatibility. When `nimToken` is present and valid (contains exactly 3 segments using either supported separator), the plugin SHALL use the parsed values and ignore the individual `appKey`, `account`, `token` fields. When `nimToken` is absent or invalid, the plugin SHALL fall back to the individual fields.

#### Scenario: Valid nimToken provided

- **WHEN** configuration includes `nimToken` with value `myAppKey|myAccount|myToken123`
- **THEN** the plugin parses it as appKey=`myAppKey`, account=`myAccount`, token=`myToken123`
- **AND** the plugin initializes successfully

#### Scenario: Legacy nimToken format remains valid

- **WHEN** configuration includes `nimToken` with value `myAppKey-myAccount-myToken123`
- **THEN** the plugin parses it as appKey=`myAppKey`, account=`myAccount`, token=`myToken123`
- **AND** the plugin initializes successfully

#### Scenario: nimToken takes priority over individual fields

- **WHEN** configuration includes both `nimToken` and individual `appKey`, `account`, `token` fields
- **THEN** the plugin uses the values parsed from `nimToken`
- **AND** the individual fields are ignored

#### Scenario: Fallback to individual fields

- **WHEN** configuration does not include `nimToken`
- **AND** configuration includes `appKey`, `account`, and `token`
- **THEN** the plugin uses the individual field values
- **AND** the plugin initializes successfully

#### Scenario: Invalid nimToken format

- **WHEN** `nimToken` is present but does not contain exactly 3 segments using either `|` or legacy `-`
- **THEN** the plugin falls back to the individual `appKey`, `account`, `token` fields

#### Scenario: Missing all credentials

- **WHEN** configuration is missing both `nimToken` and the individual `appKey`/`account`/`token` fields
- **THEN** the plugin reports `configured: false`
- **AND** does not attempt connection

### Requirement: WebSocket Connection

The NIM plugin SHALL establish a WebSocket connection to the NIM server using the configured credentials, identifying itself as an AI Bot (aiBot = 2).

#### Scenario: Initial connection

- **WHEN** the plugin starts with valid configuration
- **THEN** a WebSocket connection is established to NIM servers
- **AND** the login request includes `aiBot: 2` to identify as an AI Bot
- **AND** the connection status is reported as `running: true`

#### Scenario: Connection failure

- **WHEN** the WebSocket connection fails
- **THEN** the plugin reports the error in `lastError`
- **AND** attempts reconnection according to SDK policy

#### Scenario: Graceful shutdown

- **WHEN** the abort signal is triggered
- **THEN** the WebSocket connection is closed cleanly
- **AND** the connection status is reported as `running: false`

### Requirement: Message Reception

The NIM plugin SHALL receive and process incoming direct messages from the NIM server.

#### Scenario: Text message received

- **WHEN** a text message is received from a user
- **THEN** the message content is extracted
- **AND** the message is dispatched to the configured agent

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

### Requirement: Message Sending

The NIM plugin SHALL send messages to users via the NIM SDK.

#### Scenario: Send text message

- **WHEN** `sendMessageNim` is called with a target and text
- **THEN** a text message is sent to the specified user
- **AND** a `NimSendResult` with `messageId` is returned

#### Scenario: Send image message

- **WHEN** `sendImageNim` is called with a target and image path
- **THEN** the image is uploaded and sent to the specified user
- **AND** a `NimSendResult` is returned

#### Scenario: Send file message

- **WHEN** `sendFileNim` is called with a target and file path
- **THEN** the file is uploaded and sent to the specified user
- **AND** a `NimSendResult` is returned

#### Scenario: Invalid target

- **WHEN** a message is sent to an invalid target
- **THEN** an error is thrown with descriptive message

### Requirement: Target Normalization

The NIM plugin SHALL normalize message targets to valid NIM account IDs.

#### Scenario: Normalize prefixed target

- **WHEN** target is `nim:user123` or `user:user123`
- **THEN** the normalized target is `user123`

#### Scenario: Plain account ID

- **WHEN** target is `user123` (no prefix)
- **THEN** the normalized target is `user123`

### Requirement: Connection Status Probing

The NIM plugin SHALL provide a probe function to check connection status.

#### Scenario: Probe healthy connection

- **WHEN** `probeNim` is called with valid configuration
- **THEN** returns `{ ok: true, account: "<account>" }`

#### Scenario: Probe unhealthy connection

- **WHEN** `probeNim` is called and connection fails
- **THEN** returns `{ ok: false, error: "<error message>" }`

### Requirement: Direct Message Policy

The NIM plugin SHALL enforce DM access policies.

#### Scenario: Open policy

- **WHEN** `dmPolicy` is set to `"open"`
- **THEN** all direct messages are accepted

#### Scenario: Allowlist policy

- **WHEN** `dmPolicy` is set to `"allowlist"`
- **AND** sender is not in `allowFrom` list
- **THEN** the message is ignored

### Requirement: Media Size Limits

The NIM plugin SHALL enforce configurable media size limits.

#### Scenario: Media within limit

- **WHEN** incoming media is smaller than `mediaMaxMb`
- **THEN** the media is downloaded and processed

#### Scenario: Media exceeds limit

- **WHEN** incoming media exceeds `mediaMaxMb`
- **THEN** the media is skipped
- **AND** a placeholder is included in the message context

### Requirement: AI Bot Identity

The NIM plugin SHALL identify itself as an AI Bot when logging in to the NIM server by passing `aiBot: 2` in the login options.

#### Scenario: Login with AI Bot identity

- **WHEN** the plugin logs in with valid credentials
- **THEN** the login request MUST include `aiBot: 2`
- **AND** the server recognizes the client as an AI Bot

#### Scenario: Bot identity affects message routing

- **WHEN** the plugin is logged in with `aiBot: 2`
- **THEN** the server routes messages according to AI Bot policies
