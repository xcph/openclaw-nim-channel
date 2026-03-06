# Changelog

English | [中文](./CHANGELOG.zh-CN.md)

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0-beta.6] - 2026-03-06

### Added
- QChat (`qchat`) policy system: `open` / `allowlist` / `disabled`, with fine-grained `allowFrom` entries supporting `serverId`, `serverId|channelId`, `serverId|channelId|accountId`, `serverId||accountId` formats
- QChat server invite auto-accept, controlled by `qchat.policy` and `allowFrom`
- QChat reply-to message support (replies reference the original message)
- Team group chat (`team`) policy with group + sender allowlist, supporting regular team (高级群) and super team (超大群) type filtering
- Delivery-time policy re-check in QChat — guards against in-flight dispatches when config changes mid-conversation
- `qchat-send.ts` hard gate (`qchatReplyEnabled`) — blocks all outbound sends when policy is disabled
- Chinese README (`README.zh-CN.md`) with bidirectional language links

### Changed
- **Breaking:** Config structure reorganized — `p2pPolicy`/`allowFrom`/`teamPolicy`/`teamAllowFrom`/`mediaMaxMb`/`textChunkLimit`/`debug` moved into nested `p2p`, `team`, `advanced`, `qchat` sub-objects
- **Breaking:** QChat config simplified — removed `qchat.enabled`, `qchat.serverIds`, `qchat.serverPolicy`; replaced with `qchat.policy` + `qchat.allowFrom`
- QChat now starts automatically when NIM credentials are configured (no longer requires `qchat.enabled: true`)
- Server IDs for subscription are derived from `qchat.allowFrom` entries automatically
- Friend request auto-accept now updates on config reload via `updateP2pPolicy()` instead of using stale closure values
- Removed message content (text preview) from `[nim] sending reply` log for privacy

### Fixed
- **QChat messages processed despite policy block**: stale closure captured `qchatPolicy` at startup and never updated on config reload, causing old gateway instances to dispatch messages with outdated `policy: open`
- **QChat listener accumulation on config reload**: `stop()` only unsubscribed servers but never removed `nim.qchatMsg.on("message")` event listeners, causing the same message to be processed multiple times by old + new listeners on the shared NIM SDK instance
- **`allowlist` with empty `allowFrom` treated as `open`**: for QChat server invites, `serverPolicy` was derived from `derivedServerIds.length > 0` instead of the actual `qchat.policy` value — `disabled` and `allowlist` with empty list both incorrectly resolved to `"open"`
- **`allowlist` with empty `allowFrom` enabled replies**: `setQchatReplyEnabled()` only checked for literal `"disabled"`, not `"allowlist"` with empty list
- **Delivery-time re-check only caught `disabled`**: QChat delivery guard checked `livePolicy === "disabled"` but missed `"allowlist"` with empty list; now uses full `isQChatAllowed()` check
- **Friend request auto-accept used stale config**: `p2pPolicy` and `allowFrom` captured once in `createNimClient` closure, never updated when config reloaded (NIM client is cached)
- **P2P `allowlist` with empty `allowFrom` not treated as disabled**: missing early return for empty list case in `isNimP2pAllowed()`
- **Team policy missing `isTeam` guard**: team policy check ran unconditionally regardless of session type

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
