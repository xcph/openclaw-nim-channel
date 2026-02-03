# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.3] - 2026-02-03

### Fixed
- Fixed plugin SDK imports from `clawdbot/plugin-sdk` to `openclaw/plugin-sdk`
- Fixed type references from `ClawdbotConfig` to `OpenClawConfig`
- Fixed type references from `ClawdbotPluginApi` to `OpenClawPluginApi`

## [0.0.2] - 2026-02-03

### Fixed
- Added `openclaw.plugin.json` manifest file (renamed from `clawdbot.plugin.json`)

## [0.0.1] - 2026-02-03

### Added
- Initial release as `openclaw-nim` (rebranded from `moltbot-nim`)
- NetEase IM (NIM) channel plugin for OpenClaw
- Message sending and receiving support
- Media file handling (images, audio, video, files)
- Long message chunking support
- DM (direct message) policy configuration
- Multi-account support via config
- Zod schema validation with numeric string coercion

### Changed
- Package renamed from `moltbot-nim` to `openclaw-nim`
- Plugin ID changed to `openclaw-nim`
- Data directory changed from `~/.moltbot-nim` to `~/.openclaw-nim`

---

## Pre-release History (as moltbot-nim)

### [0.1.x] - 2026-01

- Initial development as `moltbot-nim`
- Basic NIM SDK integration
- Channel plugin architecture
