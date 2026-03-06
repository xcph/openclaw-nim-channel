# OpenClaw NIM Plugin

English | [中文](./README.zh-CN.md)

A [OpenClaw](https://openclaw.ai/) channel plugin for NetEase IM (网易云信), supporting P2P private chat, team group chat, and QChat (圈组) circle group.

## Features

- 💬 Private chat (P2P) message support with configurable access policy
- 👥 Team group chat support with group/sender allowlist
- 🔵 QChat (圈组) circle group support with unified allowlist
- 📷 Media support (images, files, audio, video)
- 🔐 AppKey + Token authentication
- 🔄 Automatic reconnection handling
- 📝 Message chunking for long responses

## Installation

### Install Node.js

#### Option 1: Official Installer (Recommended)

1. Visit [nodejs.org](https://nodejs.org/).
2. Download the **LTS** version (e.g., v20.x.x).
3. Run the installer and follow the prompts.

#### Option 2: NVM (Node Version Manager)

```bash
# Install nvm (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Restart terminal or run:
source ~/.zshrc  # or ~/.bashrc for bash

# Install Node.js LTS
nvm install --lts
nvm use --lts
```

#### Option 3: Homebrew (macOS)

```bash
brew install node
```

#### Verify Installation

```bash
node --version  # Should show v20.x.x or higher
```

### Install OpenClaw

```bash
npm install -g openclaw@latest
```

> **Note:** If you see permission errors, use `sudo npm install -g openclaw@latest`

### Install Plugin

```bash
openclaw plugins install openclaw-nim
```

## Configuration

### Quick Setup (CLI)

```bash
openclaw config set channels.nim.appKey "your-app-key"
openclaw config set channels.nim.account "your-bot-account-id"
openclaw config set channels.nim.token "your-auth-token"
openclaw config set channels.nim.enabled true
```

### Full Configuration (YAML)

```yaml
channels:
  nim:
    enabled: true
    appKey: "your-app-key"
    account: "your-bot-account-id"
    token: "your-auth-token"

    # P2P private chat settings
    p2p:
      policy: open          # open | allowlist | disabled
      allowFrom:            # Required when policy="allowlist"
        - "user_abc"
        - "user_xyz"

    # Team group chat settings
    team:
      policy: open          # open | allowlist | disabled
      allowFrom:            # Required when policy="allowlist"
        - "groupId_1"                # Any sender in this team (regular or super)
        - "groupId_2|user_abc"       # Only user_abc in this team
        - "1|groupId_3"              # Any sender, regular team only (高级群)
        - "2|groupId_4"              # Any sender, super team only (超大群)
        - "1|groupId_5|user_xyz"     # Only user_xyz, regular team only

    # QChat (圈组) circle group settings
    qchat:
      policy: open          # open | allowlist | disabled
      allowFrom:            # Required when policy="allowlist"
        - "serverId_1"                          # Any channel, any sender in this server
        - "serverId_2|channelId_1"              # Any sender in this server+channel
        - "serverId_2|channelId_2|user_abc"     # Only user_abc in this server+channel
        - "serverId_3||user_xyz"                # Only user_xyz in any channel of this server

    # Advanced settings
    advanced:
      mediaMaxMb: 30        # Max media file size in MB (default: 30)
      textChunkLimit: 4000  # Max characters per message chunk (default: 4000)
      debug: false          # Enable SDK debug logging (default: false)
```

### Configuration Reference

#### Top-level Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable/disable the NIM channel |
| `appKey` | string | — | NIM application AppKey (required) |
| `account` | string | — | Bot account ID (required) |
| `token` | string | — | Authentication token (required) |

#### `p2p` — Private Chat (私聊)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `policy` | string | `"open"` | `open` · `allowlist` · `disabled` |
| `allowFrom` | array | `[]` | Allowed sender account IDs (used when `policy="allowlist"`) |

**Policy behavior:**

| `policy` | `allowFrom` | Message handling | Friend request auto-accept |
|----------|-------------|-----------------|----------------------------|
| `open` | any | Accept all messages | Auto-accept all |
| `allowlist` | non-empty | Accept only listed senders | Auto-accept only listed senders |
| `allowlist` | empty | Same as `disabled` — reject all | Do not auto-accept |
| `disabled` | any | Reject all messages | Do not auto-accept |

#### `team` — Group Chat (群组)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `policy` | string | `"open"` | `open` · `allowlist` · `disabled` |
| `allowFrom` | array | `[]` | Allowlist entries — see formats below (used when `policy="allowlist"`) |

**Policy behavior:** same rules as P2P — `allowlist` with an empty `allowFrom` behaves as `disabled`.

**`team.allowFrom` entry formats:**

| Format | Description |
|--------|-------------|
| `"teamId"` | Any sender in this team (matches both regular and super team) |
| `"teamId\|accountId"` | Specific sender in this team (matches both types) |
| `"1\|teamId"` | Any sender, regular team only (高级群) |
| `"2\|teamId"` | Any sender, super team only (超大群) |
| `"1\|teamId\|accountId"` | Specific sender, regular team only |
| `"2\|teamId\|accountId"` | Specific sender, super team only |

#### `qchat` — QChat Circle Group (圈组)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `policy` | string | `"open"` | `open` · `allowlist` · `disabled` |
| `allowFrom` | array | `[]` | Allowlist entries — see formats below (used when `policy="allowlist"`) |

QChat starts automatically whenever NIM credentials are configured. Set `policy: "disabled"` to opt out entirely.

**Policy behavior:** same rules as P2P — `allowlist` with an empty `allowFrom` behaves as `disabled`.

**`qchat.allowFrom` entry formats:**

| Format | Description |
|--------|-------------|
| `"serverId"` | Any channel, any sender in this server |
| `"serverId\|channelId"` | Any sender in this server+channel |
| `"serverId\|channelId\|accountId"` | Specific sender in this server+channel |
| `"serverId\|\|accountId"` | Specific sender in any channel of this server |

The `allowFrom` list (when `policy="allowlist"`) also controls:
- **Server subscription**: server IDs extracted from entries are subscribed to automatically; `policy="open"` triggers auto-discovery of all joined servers.
- **Server invite auto-accept**: controlled by `policy`:
  - `open` — auto-accept all server invites
  - `allowlist` — auto-accept only invites from server IDs in the `allowFrom` list; empty list rejects all
  - `disabled` — do not auto-accept any invites

#### `advanced` — Advanced Settings (基础设置)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `mediaMaxMb` | number | `30` | Max media file size in MB |
| `textChunkLimit` | number | `4000` | Max characters per message chunk |
| `debug` | boolean | `false` | Enable SDK debug logging |

## Getting Credentials

1. Log in to the [NetEase IM Console](https://app.netease.im/)
2. Create or select an application
3. Copy the **AppKey** from the application settings
4. Create a bot account and obtain its **Account ID** and **Token**

## Start the Bot

```bash
openclaw onboard
```

## Usage

### Sending Messages

```typescript
import {
  sendMessageNim,
  sendImageNim,
  sendFileNim,
  sendAudioNim,
  sendVideoNim,
} from "openclaw-nim";

// Send text message
await sendMessageNim({
  cfg: openclawConfig,
  to: "user123",
  text: "Hello from NIM bot!",
});

// Send image (supports: .jpg, .jpeg, .png, .gif, .webp, .bmp)
await sendImageNim({
  cfg: openclawConfig,
  to: "user123",
  imagePath: "/path/to/image.png",
});

// Send video (supports: .mp4, .mov, .avi, .mkv, .webm, .flv)
await sendVideoNim({
  cfg: openclawConfig,
  to: "user123",
  videoPath: "/path/to/video.mp4",
  duration: 60,    // duration in seconds
  width: 1920,
  height: 1080,
});

// Send audio (supports: .mp3, .wav, .aac, .m4a, .ogg, .amr)
await sendAudioNim({
  cfg: openclawConfig,
  to: "user123",
  audioPath: "/path/to/audio.mp3",
  duration: 30,    // duration in seconds
});

// Send file (any file type)
await sendFileNim({
  cfg: openclawConfig,
  to: "user123",
  filePath: "/path/to/document.pdf",
});
```

### Target Formats

| Format | Description |
|--------|-------------|
| `user123` | Plain account ID |
| `nim:user123` | Prefixed with `nim:` |
| `user:user123` | Prefixed with `user:` |

## Supported Message Types

| Type | Receive | Send |
|------|---------|------|
| Text | ✅ | ✅ |
| Image | ✅ | ✅ |
| File | ✅ | ✅ |
| Audio | ✅ | ✅ |
| Video | ✅ | ✅ |
| Location | ✅ | ❌ |
| Custom | ✅ | ❌ |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run dev
```

## License

MIT
