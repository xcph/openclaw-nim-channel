## MODIFIED Requirements

### Requirement: Plugin Registration

The NIM plugin SHALL register as a Clawdbot channel plugin with the channel ID `nim` and package name `openclaw-nim`.

#### Scenario: Plugin loaded by Clawdbot
- **WHEN** Clawdbot loads the NIM plugin
- **THEN** the plugin registers with:
  - Plugin ID: `openclaw-nim`
  - Channel ID: `nim`
  - Display name: `OpenClaw NIM Plugin`

### Requirement: SDK Data Directory

The plugin SHALL store SDK data files in the user's home directory under `~/.openclaw-nim/<account>/`.

#### Scenario: Data directory creation
- **GIVEN** a user configures NIM account `12345`
- **WHEN** the NIM client initializes
- **THEN** SDK data files are stored in `~/.openclaw-nim/12345/`
