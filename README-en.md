# OpenClaw NIM Plugin

English | [中文](./README.zh-CN.md)

A [OpenClaw](https://openclaw.ai/) channel plugin for NetEase IM (网易云信), supporting P2P private chat, team group chat, and QChat (圈组) circle group.

## Requirements

> **⚠️ Breaking Changes in v1.0.0**
>
> 1. **OpenClaw Version**: Requires OpenClaw **2026.3.24 or later** (this version uses the new OpenClaw plugin API and is incompatible with older versions)
> 2. **Configuration Format**: `channels.nim` changed from single object to **array format** (see examples below)
> 3. **Account Type**: Only **bot accounts** are supported (regular personal accounts are not supported)
> 4. **Credentials**: Recommended to use `nimToken` shorthand format (`appKey|accid|token`, legacy `appKey-accid-token` still supported)

## Features

- 💬 Private chat (P2P) message support with configurable access policy
- 👥 Team group chat support with group/sender allowlist
- 🔵 QChat (圈组) circle group support with unified allowlist
- 🌊 **Streaming output support** (P2P and team messages support block streaming; QChat uses complete message delivery)
- 🔄 **Multi-instance support** (run up to 3 NIM instances simultaneously with different accounts/AppKeys)
- 📷 Media support (images, files, audio, video)
- 🔐 Simplified `nimToken` authentication (`appKey|accid|token` preferred, legacy `appKey-accid-token` supported)
- 🔄 Automatic reconnection handling
- 📝 Message chunking for long responses
- 🔒 Private deployment (privatization) support with custom server URLs

## Installation

### Install Node.js

> **Recommended**: Node.js **v24.x** (>=24.0.0, <25.0.0)

#### Option 1: Official Installer (Recommended)

1. Visit [nodejs.org](https://nodejs.org/).
2. Download **Node.js v24.x**.
3. Run the installer and follow the prompts.

#### Option 2: NVM (Node Version Manager)

```bash
# Install nvm (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Restart terminal or run:
source ~/.zshrc  # or ~/.bashrc for bash

# Install Node.js v24
nvm install 24
nvm use 24
```

#### Option 3: Homebrew (macOS)

```bash
# Install Node.js v24
brew install node@24
brew link node@24
```

#### Verify Installation

```bash
node --version  # Should show v24.x.x
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

> **Note**: Starting from v1.0.0, `channels.nim` uses an **array format** to support multiple NIM instances (up to 3). Each instance can have different credentials and policies.

### Quick Setup (CLI)

```bash
# Note: CLI commands configure the first instance (index 0)
openclaw config set channels.nim.0.nimToken "<appKey>|<accid>|<token>"
openclaw config set channels.nim.0.enabled true
```

> **`nimToken` format**: `<appKey>|<accid>|<token>` (three fields separated by `|`) — **Recommended**
>
> Example: `45c6af3c98409b18a84451215d0bdd6e|testbot001|a1b2c3d4e5f6`
>
> Backward compatibility: legacy `<appKey>-<accid>-<token>` is still accepted
>
> Alternative: Use separate `appKey`, `account`, `token` fields (deprecated but still supported)

#### Private Deployment (CLI)

```bash
openclaw config set channels.nim.0.advanced.weblbsUrl "https://your-lbs.example.com"
openclaw config set channels.nim.0.advanced.link_web "weblink.netease.im:443"
openclaw config set channels.nim.0.advanced.nos_uploader "https://your-nos-upload.example.com"
openclaw config set channels.nim.0.advanced.nos_downloader_v2 "https://your-nos-download.example.com/{bucket}/{object}"
openclaw config set channels.nim.0.advanced.nosSsl true
openclaw config set channels.nim.0.advanced.nos_accelerate "https://your-cdn.example.com/{bucket}/{object}"
openclaw config set channels.nim.0.advanced.nos_accelerate_host "your-cdn.example.com"
```

### Single Instance Configuration

```json
{
  "channels": {
    "nim": [
      {
        "enabled": true,
        "nimToken": "<appKey>|<accid>|<token>",

        "p2p": {
          "policy": "open",
          "allowFrom": ["user_abc", "user_xyz"]
        },

        "team": {
          "policy": "open",
          "allowFrom": [
            "groupId_1",
            "groupId_2|user_abc",
            "1|groupId_3",
            "2|groupId_4",
            "1|groupId_5|user_xyz"
          ]
        },

        "qchat": {
          "policy": "open",
          "allowFrom": [
            "serverId_1",
            "serverId_2|channelId_1",
            "serverId_2|channelId_2|user_abc",
            "serverId_3||user_xyz"
          ]
        },

        "advanced": {
          "mediaMaxMb": 30,
          "textChunkLimit": 4000,
          "debug": false,
          "weblbsUrl": "https://your-lbs.example.com",
          "link_web": "weblink.netease.im:443",
          "nos_uploader": "https://your-nos-upload.example.com",
          "nos_downloader_v2": "https://your-nos-download.example.com/{bucket}/{object}",
          "nosSsl": true,
          "nos_accelerate": "https://your-cdn.example.com/{bucket}/{object}",
          "nos_accelerate_host": "your-cdn.example.com"
        }
      }
    ]
  }
}
```

### Multi-Instance Configuration

Run up to 3 NIM instances simultaneously with different accounts or AppKeys:

```json
{
  "channels": {
    "nim": [
      {
        "enabled": true,
        "nimToken": "<appKey1>|<bot1>|<token1>",
        "p2p": { "policy": "open" },
        "team": { "policy": "allowlist", "allowFrom": ["team_abc"] },
        "qchat": { "policy": "disabled" }
      },
      {
        "enabled": true,
        "nimToken": "<appKey1>|<bot2>|<token2>",
        "p2p": { "policy": "allowlist", "allowFrom": ["user_vip"] },
        "team": { "policy": "disabled" },
        "qchat": { "policy": "open" }
      },
      {
        "enabled": false,
        "nimToken": "<appKey2>|<bot3>|<token3>",
        "p2p": { "policy": "open" }
      }
    ]
  }
}
```

> **Note**: Maximum 3 instances total (enabled or disabled). Each instance maintains its own connection and can have different policies.

### Streaming Output Configuration

**P2P and Team messages** support block streaming for real-time response delivery. **QChat messages** use complete message delivery (streaming is force-disabled).

To enable streaming, configure OpenClaw's block streaming settings:

```yaml
# config.yaml
agents:
  defaults:
    blockStreamingDefault: "on"
    blockStreamingBreak: "text_end"
    blockStreamingChunk:
      minChars: 150
      maxChars: 600

channels:
  nim:
    - enabled: true
      nimToken: "your-credentials"
```

For detailed streaming configuration, see:

- [`BLOCK_STREAMING_CONFIG.md`](./BLOCK_STREAMING_CONFIG.md) — Block streaming setup guide
- [`STREAMING_GUIDE.md`](./STREAMING_GUIDE.md) — Real-time streaming data usage

> **QChat Special Note**: Streaming and text chunking are force-disabled for QChat messages to prevent message fragmentation and improve user experience. QChat always delivers complete messages.

### Configuration Reference

#### Top-level Fields

| Field             | Type    | Default | Description                                 |
| ----------------- | ------- | ------- | ------------------------------------------- |
| `enabled`         | boolean | `false` | Enable/disable the NIM channel              |
| `nimToken`        | string  | —       | Credential: `appKey\|accid\|token` (preferred), legacy `appKey-accid-token` also supported |
| `antispamEnabled` | boolean | `true`  | Enable anti-spam protection                 |

#### `p2p` — Private Chat (私聊)

| Field       | Type   | Default  | Description                                                 |
| ----------- | ------ | -------- | ----------------------------------------------------------- |
| `policy`    | string | `"open"` | `open` · `allowlist` · `disabled`                           |
| `allowFrom` | array  | `[]`     | Allowed sender account IDs (used when `policy="allowlist"`) |

**Policy behavior:**

| `policy`    | `allowFrom` | Message handling                | Friend request auto-accept      |
| ----------- | ----------- | ------------------------------- | ------------------------------- |
| `open`      | any         | Accept all messages             | Auto-accept all                 |
| `allowlist` | non-empty   | Accept only listed senders      | Auto-accept only listed senders |
| `allowlist` | empty       | Same as `disabled` — reject all | Do not auto-accept              |
| `disabled`  | any         | Reject all messages             | Do not auto-accept              |

#### `team` — Group Chat (群组)

| Field       | Type   | Default  | Description                                                            |
| ----------- | ------ | -------- | ---------------------------------------------------------------------- |
| `policy`    | string | `"open"` | `open` · `allowlist` · `disabled`                                      |
| `allowFrom` | array  | `[]`     | Allowlist entries — see formats below (used when `policy="allowlist"`) |

**Policy behavior:** same rules as P2P — `allowlist` with an empty `allowFrom` behaves as `disabled`.

**`team.allowFrom` entry formats:**

| Format                   | Description                                                   |
| ------------------------ | ------------------------------------------------------------- |
| `"teamId"`               | Any sender in this team (matches both regular and super team) |
| `"teamId\|accountId"`    | Specific sender in this team (matches both types)             |
| `"1\|teamId"`            | Any sender, regular team only (高级群)                        |
| `"2\|teamId"`            | Any sender, super team only (超大群)                          |
| `"1\|teamId\|accountId"` | Specific sender, regular team only                            |
| `"2\|teamId\|accountId"` | Specific sender, super team only                              |

#### `qchat` — QChat Circle Group (圈组)

| Field       | Type   | Default  | Description                                                            |
| ----------- | ------ | -------- | ---------------------------------------------------------------------- |
| `policy`    | string | `"open"` | `open` · `allowlist` · `disabled`                                      |
| `allowFrom` | array  | `[]`     | Allowlist entries — see formats below (used when `policy="allowlist"`) |

QChat starts automatically whenever NIM credentials are configured. Set `policy: "disabled"` to opt out entirely.

**Policy behavior:** same rules as P2P — `allowlist` with an empty `allowFrom` behaves as `disabled`.

**`qchat.allowFrom` entry formats:**

| Format                             | Description                                   |
| ---------------------------------- | --------------------------------------------- |
| `"serverId"`                       | Any channel, any sender in this server        |
| `"serverId\|channelId"`            | Any sender in this server+channel             |
| `"serverId\|channelId\|accountId"` | Specific sender in this server+channel        |
| `"serverId\|\|accountId"`          | Specific sender in any channel of this server |

The `allowFrom` list (when `policy="allowlist"`) also controls:

- **Server subscription**: server IDs extracted from entries are subscribed to automatically; `policy="open"` triggers auto-discovery of all joined servers.
- **Server invite auto-accept**: controlled by `policy`:
  - `open` — auto-accept all server invites
  - `allowlist` — auto-accept only invites from server IDs in the `allowFrom` list; empty list rejects all
  - `disabled` — do not auto-accept any invites

#### `advanced` — Advanced Settings

| Field                 | Type    | Default | Description                                          |
| --------------------- | ------- | ------- | ---------------------------------------------------- |
| `mediaMaxMb`          | number  | `30`    | Max media file size in MB                            |
| `textChunkLimit`      | number  | `4000`  | Max characters per message chunk                     |
| `debug`               | boolean | `false` | Enable SDK debug logging                             |
| `weblbsUrl`           | string  | —       | LBS URL (private deployment)                         |
| `link_web`            | string  | —       | WebSocket/TCP link address (private deployment)      |
| `nos_uploader`        | string  | —       | NOS upload URL (private deployment)                  |
| `nos_downloader_v2`   | string  | —       | NOS download URL format (private deployment)         |
| `nosSsl`              | boolean | —       | Whether NOS download uses HTTPS (private deployment) |
| `nos_accelerate`      | string  | —       | CDN accelerate URL format (private deployment)       |
| `nos_accelerate_host` | string  | —       | CDN accelerate host domain (private deployment)      |

## Getting Credentials

> **Important**: Only **bot accounts** are supported. Regular personal accounts cannot be used with this plugin.

1. Log in to the [NetEase IM Console](https://app.netease.im/)
2. Create or select an application
3. Copy the **AppKey** from the application settings
4. **Create a bot account** (not a regular personal account) and obtain its **Account ID** and **Token**

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
  duration: 60, // duration in seconds
  width: 1920,
  height: 1080,
});

// Send audio (supports: .mp3, .wav, .aac, .m4a, .ogg, .amr)
await sendAudioNim({
  cfg: openclawConfig,
  to: "user123",
  audioPath: "/path/to/audio.mp3",
  duration: 30, // duration in seconds
});

// Send file (any file type)
await sendFileNim({
  cfg: openclawConfig,
  to: "user123",
  filePath: "/path/to/document.pdf",
});
```

### Target Formats

| Format         | Description           |
| -------------- | --------------------- |
| `user123`      | Plain account ID      |
| `nim:user123`  | Prefixed with `nim:`  |
| `user:user123` | Prefixed with `user:` |

## Supported Message Types

| Type     | Receive | Send |
| -------- | ------- | ---- |
| Text     | ✅      | ✅   |
| Image    | ✅      | ✅   |
| File     | ✅      | ✅   |
| Audio    | ✅      | ✅   |
| Video    | ✅      | ✅   |
| Location | ✅      | ❌   |
| Custom   | ✅      | ❌   |

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
