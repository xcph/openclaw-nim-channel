## MODIFIED Requirements

### Requirement: Plugin Registration

The NIM plugin SHALL register as a Clawdbot channel plugin with the channel ID `nim` and package name `openclaw-nim`. The plugin package SHALL bundle its runtime dependencies (`@yxim/nim-bot`, `zod`) via `bundledDependencies` to ensure reliable installation in isolated environments (e.g., OpenClaw's plugin install sandbox) without requiring external npm registry access at install time.

#### Scenario: Plugin loaded by Clawdbot

- **WHEN** Clawdbot loads the NIM plugin
- **THEN** the plugin registers with:
  - Plugin ID: `openclaw-nim`
  - Channel ID: `nim`
  - Display name: `OpenClaw NIM Plugin`
- **AND** the plugin exposes the `nimPlugin` ChannelPlugin implementation

#### Scenario: Plugin installed via OpenClaw plugins install

- **WHEN** the plugin is installed via `openclaw plugins install clawhub:openclaw-nim`
- **THEN** npm install in the isolated stage directory SHALL succeed without errors
- **AND** bundled dependencies (`@yxim/nim-bot`, `zod`) are available without external registry access
- **AND** the plugin is installed to the extensions directory
