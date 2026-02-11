# OpenClaw NIM Plugin

A [OpenClaw](https://openclaw.ai/) channel plugin for NetEase IM (网易云信).

## Features

- 📱 Private chat (P2P) message support
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

NVM allows you to install and manage multiple Node.js versions:

```bash
# Install nvm (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Restart terminal or run:
source ~/.zshrc  # or ~/.bashrc for bash

# Install Node.js LTS
nvm install --lts

# Use the installed version
nvm use --lts
```

#### Option 3: Homebrew (macOS)

If you have Homebrew installed:

```bash
brew install node
```

#### Verify Installation

```bash
node --version
# Should show v20.x.x or higher
```

### Install OpenClaw

Open Terminal

Press `Cmd + Space`, type `Terminal`, and hit Enter.

Install CLI

```bash
npm install -g openclaw@latest
```

> **Note:** If you see permission errors, use `sudo`:
>
> ```bash
> sudo npm install -g openclaw@latest
> ```

### Installation Plugin

```bash
openclaw plugins install openclaw-nim
```

## Configuration

```bash
openclaw config set channels.nim.appKey "your-app-key"
openclaw config set channels.nim.account "your-bot-account-id"
openclaw config set channels.nim.token "your-auth-token"
openclaw config set channels.nim.enabled true     
```

Or add the following to your OpenClaw configuration (`openclaw.yaml` or `openclaw.json`):

```yaml
channels:
  nim:
    enabled: true
    appKey: "your-app-key"
    account: "your-bot-account-id"
    token: "your-auth-token"
    dmPolicy: "open"  # or "allowlist"
    allowFrom:        # Required if dmPolicy is "allowlist"
      - "allowed-user-1"
      - "allowed-user-2"
    mediaMaxMb: 30    # Max media file size in MB
    textChunkLimit: 4000  # Max characters per message
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable/disable the NIM channel |
| `appKey` | string | - | NIM application AppKey (required) |
| `account` | string | - | Bot account ID (required) |
| `token` | string | - | Authentication token (required) |
| `dmPolicy` | string | `"open"` | DM access policy: `"open"` or `"allowlist"` |
| `allowFrom` | array | `[]` | List of allowed sender IDs (when using allowlist) |
| `mediaMaxMb` | number | `30` | Maximum media file size in MB |
| `textChunkLimit` | number | `4000` | Maximum characters per message chunk |
| `lbsUrl` | string | - | Custom LBS server URL (for private deployment) |
| `linkUrl` | string | - | Custom Link server URL (for private deployment) |
| `debug` | boolean | `false` | Enable SDK debug logging |

## Start the Bot

```bash
openclaw onboard
```

## Getting Credentials

1. Log in to the [NetEase IM Console](https://app.netease.im/)
2. Create or select an application
3. Copy the **AppKey** from the application settings
4. Create a bot account and obtain its **Account ID** and **Token**

## Usage

### Sending Messages

```typescript
import { 
  sendMessageNim, 
  sendImageNim, 
  sendFileNim, 
  sendAudioNim, 
  sendVideoNim 
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
  duration: 60,  // duration in seconds
  width: 1920,   // video width in pixels
  height: 1080,  // video height in pixels
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

The plugin accepts various target formats:

- `user123` - Plain account ID
- `nim:user123` - Prefixed with `nim:`
- `user:user123` - Prefixed with `user:`

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

## Limitations

- **Private chat only**: Group chat support is not implemented in this version
- **No message editing**: NIM does not support editing sent messages
- **No reactions**: Message reactions are not supported
- **No threads**: Thread/reply functionality is not supported

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
