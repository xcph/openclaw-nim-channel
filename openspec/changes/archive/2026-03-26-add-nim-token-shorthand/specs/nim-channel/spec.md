## MODIFIED Requirements

### Requirement: Channel Configuration

The NIM plugin SHALL accept configuration under `channels.nim` with the following fields:

- **Required** (at least one方式): `nimToken` (shorthand) OR `appKey` + `account` + `token` (individual fields)
- **Optional**: other sub-configurations (p2p, team, qchat, advanced)

The `nimToken` field is a shorthand format: `appKey-accid-token` (three segments separated by `-`). When `nimToken` is present and valid (contains exactly 3 segments), the plugin SHALL use the parsed values and ignore the individual `appKey`, `account`, `token` fields. When `nimToken` is absent or invalid, the plugin SHALL fall back to the individual fields.

#### Scenario: Valid nimToken provided

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

- **WHEN** `nimToken` is present but does not contain exactly 3 `-`-separated segments
- **THEN** the plugin falls back to the individual `appKey`, `account`, `token` fields

#### Scenario: Missing all credentials

- **WHEN** configuration is missing both `nimToken` and the individual `appKey`/`account`/`token` fields
- **THEN** the plugin reports `configured: false`
- **AND** does not attempt connection
