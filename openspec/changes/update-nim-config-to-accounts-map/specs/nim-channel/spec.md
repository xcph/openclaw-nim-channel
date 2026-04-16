## MODIFIED Requirements

### Requirement: Channel Configuration

The NIM plugin SHALL accept configuration under `channels.nim.accounts` as an object map keyed by user-defined account names, where each value is a complete, independent account configuration.

Each account entry MUST contain:

- At least one credential method: `nimToken` shorthand OR individual `appKey` + `account` + `token` fields
- `enabled` (boolean, default `false`): whether this account should be started

Each account entry MAY contain independent sub-configurations:

- `p2p` — P2P direct message policy (policy, allowFrom)
- `team` — Team/group message policy (policy, allowFrom)
- `qchat` — QChat message policy (policy, allowFrom)
- `advanced` — Advanced settings (mediaMaxMb, textChunkLimit, debug, private deploy URLs)

The total number of configured entries in `channels.nim.accounts` SHALL NOT exceed **3**. Validation is enforced at configuration parse time.

The `nimToken` shorthand format behaves identically to the single-instance behavior: preferred `appKey|accid|token`, with legacy `appKey-accid-token` accepted for backward compatibility. When present and valid, the plugin uses the parsed values; otherwise it falls back to individual fields.

The plugin SHALL continue deriving the internal runtime `accountId` as `"<appKey>:<accid>"`. The user-defined account map key is a configuration key only and SHALL NOT replace the derived runtime `accountId`.

**BREAKING CHANGE**: The previous `channels.nim.instances[]` format is no longer supported. Users MUST migrate to `channels.nim.accounts.<accountKey>`.

#### Scenario: Valid single named account

- **WHEN** configuration includes `channels.nim.accounts.primary` with valid credentials
- **THEN** the plugin initializes one NIM connection for that account entry
- **AND** the derived runtime `accountId` is `"<appKey>:<accid>"`

#### Scenario: Multiple named accounts under same appKey

- **WHEN** `channels.nim.accounts` contains `botA` and `botB` sharing the same `appKey` but different `account` values
- **THEN** the plugin starts two independent WebSocket connections
- **AND** each account entry routes messages independently

#### Scenario: Exceeding account limit

- **WHEN** `channels.nim.accounts` contains more than 3 entries
- **THEN** configuration validation fails with a descriptive error
- **AND** no instances are started

#### Scenario: Duplicate credentials across named accounts

- **WHEN** two `channels.nim.accounts.*` entries resolve to the same `appKey:accid`
- **THEN** configuration validation fails with a descriptive error

#### Scenario: Legacy instances array is rejected

- **WHEN** configuration uses `channels.nim.instances`
- **THEN** the plugin does not treat it as valid multi-instance configuration
- **AND** the user must migrate to `channels.nim.accounts`

## MODIFIED Requirements

### Requirement: Instance Identity and Enumeration

Each configured NIM account SHALL still be automatically assigned a unique runtime `accountId` derived from its credentials using the format `"<appKey>:<accid>"`. The plugin SHALL enumerate all derived `accountId` values from `channels.nim.accounts` when queried for available accounts.

Duplicate credentials (same `appKey:accid` appearing more than once in the accounts map) SHALL be rejected at configuration parse time.

#### Scenario: List account IDs returns all named accounts

- **WHEN** `listAccountIds` is called on the plugin
- **THEN** it returns the derived `appKey:accid` identifiers for all configured account entries
- **AND** the list contains no duplicates

#### Scenario: Resolve account by derived ID

- **WHEN** `resolveAccount` is called with an `accountId` of `"appKey1:bot001"`
- **THEN** it returns the configured account entry whose credentials resolve to that combination
- **AND** the account's credentials reflect that entry's configuration
