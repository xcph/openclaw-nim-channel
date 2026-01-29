# MoltBot NIM Plugin

A [Clawdbot](https://clawdbot.dev) channel plugin for NetEase IM (网易云信).

## Features

- 📱 Private chat (P2P) message support
- 📷 Media support (images, files, audio, video)
- 🔐 AppKey + Token authentication
- 🔄 Automatic reconnection handling
- 📝 Message chunking for long responses

## Installation

```bash
npm install @moltbot/nim
```

Or add to your Clawdbot configuration:

```json
{
  "plugins": ["@moltbot/nim"]
}
```

## Configuration

Add the following to your Clawdbot configuration (`clawdbot.yaml` or `clawdbot.json`):

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

## Getting Credentials

1. Log in to the [NetEase IM Console](https://app.netease.im/)
2. Create or select an application
3. Copy the **AppKey** from the application settings
4. Create a bot account and obtain its **Account ID** and **Token**

## Usage

### Sending Messages

```typescript
import { sendMessageNim, sendImageNim } from "@moltbot/nim";

// Send text message
await sendMessageNim({
  cfg: clawdbotConfig,
  to: "user123",
  text: "Hello from NIM bot!",
});

// Send image
await sendImageNim({
  cfg: clawdbotConfig,
  to: "user123",
  imagePath: "/path/to/image.png",
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
