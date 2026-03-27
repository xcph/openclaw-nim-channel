## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: AI Bot Identity

The NIM plugin SHALL identify itself as an AI Bot when logging in to the NIM server by passing `aiBot: 2` in the login options.

#### Scenario: Login with AI Bot identity

- **WHEN** the plugin logs in with valid credentials
- **THEN** the login request MUST include `aiBot: 2`
- **AND** the server recognizes the client as an AI Bot

#### Scenario: Bot identity affects message routing

- **WHEN** the plugin is logged in with `aiBot: 2`
- **THEN** the server routes messages according to AI Bot policies
