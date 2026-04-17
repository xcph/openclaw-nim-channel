## MODIFIED Requirements

### Requirement: Channel Configuration

The NIM plugin SHALL accept configuration under `channels.nim` as an **array** of instance objects, where each element is a complete, independent instance configuration.

Each instance object MUST contain:

- At least one credential method: `nimToken` shorthand OR individual `appKey` + `account` + `token` fields
- `enabled` (boolean, default `false`): whether this instance should be started

Each instance does **not** require a manually specified `id`. The system automatically derives a unique `accountId` for each instance using the format `"<appKey>:<accid>"` (e.g., `"appKey1:bot001"`). This derived key is used as the internal routing identifier throughout the plugin framework.

Each instance object MAY contain independent sub-configurations:

- `p2p` — P2P direct message policy (policy, allowFrom)
- `team` — Team/group message policy (policy, allowFrom)
- `qchat` — QChat message policy (policy, allowFrom)
- `advanced` — Advanced settings (mediaMaxMb, textChunkLimit, debug, private deploy URLs)

The total number of instances in the array SHALL NOT exceed **3**. Validation is enforced at configuration parse time.

The `nimToken` shorthand format behaves identically to the single-instance behavior: preferred `appKey|accid|token`, with legacy `appKey-accid-token` accepted for backward compatibility. When present and valid (contains exactly 3 segments using either supported separator), the plugin uses the parsed values; otherwise it falls back to individual fields.

**BREAKING CHANGE**: The previous single-object format for `channels.nim` is no longer supported. Users must migrate to the array format.

#### Scenario: Valid single instance in array

- **WHEN** configuration includes `channels.nim` as an array with one element containing valid credentials (`appKey: "appKey1"`, `account: "bot001"`)
- **THEN** the plugin initializes one NIM connection for that instance
- **AND** the derived `accountId` is `"appKey1:bot001"`

#### Scenario: Multiple instances with different accounts under same appKey

- **WHEN** `channels.nim` contains two entries sharing the same `appKey` but different `account` values
- **THEN** the plugin starts two independent WebSocket connections
- **AND** each instance receives and routes messages independently

#### Scenario: Multiple instances across different appKeys

- **WHEN** `channels.nim` contains two entries with different `appKey` values
- **THEN** the plugin starts two independent NIM clients with separate SDK data directories
- **AND** each instance routes messages independently

#### Scenario: Exceeding instance limit

- **WHEN** `channels.nim` contains more than 3 instance entries
- **THEN** configuration validation fails with a descriptive error
- **AND** no instances are started

#### Scenario: Instance with nimToken shorthand

- **WHEN** an instance entry contains `nimToken: "myAppKey|myAccount|myToken123"`
- **THEN** the plugin parses it as `appKey=myAppKey`, `account=myAccount`, `token=myToken123` for that instance

#### Scenario: Instance with legacy nimToken shorthand

- **WHEN** an instance entry contains `nimToken: "myAppKey-myAccount-myToken123"`
- **THEN** the plugin parses it as `appKey=myAppKey`, `account=myAccount`, `token=myToken123` for that instance

#### Scenario: Instance missing all credentials

- **WHEN** an instance entry is missing both `nimToken` and the individual `appKey`/`account`/`token` fields
- **THEN** that instance reports `configured: false`
- **AND** does not attempt connection

#### Scenario: Disabled instance not started

- **WHEN** an instance has `enabled: false`
- **THEN** the plugin does NOT start a connection for that instance
- **AND** the instance is still counted toward the 3-instance limit

#### Scenario: Duplicate credentials

- **WHEN** two entries in `channels.nim` resolve to the same `appKey:accid` combination
- **THEN** configuration validation fails with a descriptive error

## MODIFIED Requirements

### Requirement: SDK Data Directory

The plugin SHALL store SDK data files in the user's home directory under `~/.openclaw-nim/<account>/`, where `<account>` is the NIM account ID resolved from that instance's credentials.

In multi-instance configurations, each instance with a distinct account ID gets its own isolated data directory.

#### Scenario: Data directory isolation between instances

- **GIVEN** two instances configured with accounts `bot1` and `bot2`
- **WHEN** both instances initialize
- **THEN** instance `bot1` stores data in `~/.openclaw-nim/bot1/`
- **AND** instance `bot2` stores data in `~/.openclaw-nim/bot2/`

#### Scenario: Data directory creation (single instance array)

- **GIVEN** a user configures a single instance with NIM account `12345`
- **WHEN** the NIM client initializes
- **THEN** SDK data files are stored in `~/.openclaw-nim/12345/`

## MODIFIED Requirements

### Requirement: WebSocket Connection

The NIM plugin SHALL establish an independent WebSocket connection for each `enabled: true` instance in the configuration array, identifying each as an AI Bot (`aiBot: 2`).

Instances are started concurrently. Each instance connection lifecycle (start, stop, reconnect) is managed independently.

#### Scenario: Multiple connections started concurrently

- **WHEN** the plugin starts with two `enabled: true` instances
- **THEN** two independent WebSocket connections are established
- **AND** each connection uses its own credentials and reports its own status

#### Scenario: One instance fails, others continue

- **WHEN** one instance fails to connect
- **THEN** only that instance reports an error in `lastError`
- **AND** other instances continue running normally

#### Scenario: Graceful shutdown of all instances

- **WHEN** the abort signal is triggered
- **THEN** all running instance connections are closed cleanly
- **AND** each instance reports `running: false`

#### Scenario: Initial connection (single enabled instance)

- **WHEN** the plugin starts with a single `enabled: true` instance containing valid configuration
- **THEN** a WebSocket connection is established to NIM servers
- **AND** the login request includes `aiBot: 2`
- **AND** the connection status is reported as `running: true`

#### Scenario: Connection failure

- **WHEN** a WebSocket connection fails for one instance
- **THEN** that instance reports the error in `lastError`
- **AND** attempts reconnection according to SDK policy

## MODIFIED Requirements

### Requirement: Message Reception

The NIM plugin SHALL receive and process incoming messages for each running instance independently. Messages received by an instance are dispatched to the configured agent using that instance's `accountId` as the routing key.

#### Scenario: Instance-scoped message routing

- **WHEN** a message is received on the instance with derived `accountId` `"appKey1:bot001"`
- **THEN** the message is dispatched to the agent using that `accountId`
- **AND** replies use the NIM client connection belonging to `"appKey1:bot001"`

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

## ADDED Requirements

### Requirement: Instance Identity and Enumeration

Each NIM instance SHALL be automatically assigned a unique `accountId` derived from its credentials using the format `"<appKey>:<accid>"`. The plugin SHALL enumerate all derived `accountId` values when queried for available accounts.

Duplicate credentials (same `appKey:accid` appearing more than once in the array) SHALL be rejected at configuration parse time.

#### Scenario: List account IDs returns all instances

- **WHEN** `listAccountIds` is called on the plugin
- **THEN** it returns the derived `appKey:accid` identifiers for all configured instances (enabled or disabled)
- **AND** the list contains no duplicates

#### Scenario: Resolve account by derived ID

- **WHEN** `resolveAccount` is called with an `accountId` of `"appKey1:bot001"`
- **THEN** it returns the `ResolvedNimAccount` for the instance whose credentials resolve to that combination
- **AND** the account's credentials reflect that instance's configuration

#### Scenario: Unknown account ID

- **WHEN** `resolveAccount` is called with an `accountId` that does not match any derived `appKey:accid`
- **THEN** it returns a `configured: false` account object

## ADDED Requirements

### Requirement: Per-Instance Direct Message Policy

Each NIM instance SHALL enforce its own independent DM access policy defined in its `p2p` sub-configuration. The DM policy of one instance SHALL NOT affect any other instance.

#### Scenario: Separate allowlists per instance

- **GIVEN** instance `"appKey1:bot001"` has `p2p.allowFrom: ["user-A"]`
- **AND** instance `"appKey1:bot002"` has `p2p.policy: "open"`
- **WHEN** user `"user-B"` sends a P2P message to both bots
- **THEN** `"appKey1:bot001"` blocks the message (not in allowlist)
- **AND** `"appKey1:bot002"` accepts the message (open policy)
