# OpenClaw NIM 插件

[English](./README.md) | 中文

[OpenClaw](https://openclaw.ai/) 网易云信（NIM）渠道插件，支持 P2P 单聊、群组聊天及圈组（QChat）。

## 功能特性

- 💬 P2P 单聊消息，支持可配置的访问策略
- 👥 群组聊天，支持群/发送者白名单
- 🔵 圈组（QChat）消息，支持统一白名单
- 📷 多媒体支持（图片、文件、音频、视频）
- 🔐 AppKey + Token 认证
- 🔄 自动重连处理
- 📝 长消息自动分片

## 安装

### 安装 Node.js

#### 方式一：官方安装包（推荐）

1. 访问 [nodejs.org](https://nodejs.org/)。
2. 下载 **LTS** 版本（如 v20.x.x）。
3. 运行安装包并按提示操作。

#### 方式二：NVM（Node 版本管理器）

```bash
# 安装 nvm（如未安装）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# 重启终端或执行：
source ~/.zshrc  # bash 用户使用 ~/.bashrc

# 安装 Node.js LTS
nvm install --lts
nvm use --lts
```

#### 方式三：Homebrew（macOS）

```bash
brew install node
```

#### 验证安装

```bash
node --version  # 应显示 v20.x.x 或更高版本
```

### 安装 OpenClaw

```bash
npm install -g openclaw@latest
```

> **注意：** 如遇权限错误，请使用 `sudo npm install -g openclaw@latest`

### 安装插件

```bash
openclaw plugins install openclaw-nim
```

## 配置

### 快速配置（CLI）

```bash
openclaw config set channels.nim.appKey "your-app-key"
openclaw config set channels.nim.account "your-bot-account-id"
openclaw config set channels.nim.token "your-auth-token"
openclaw config set channels.nim.enabled true
```

### 完整配置（YAML）

```yaml
channels:
  nim:
    enabled: true
    appKey: "your-app-key"
    account: "your-bot-account-id"
    token: "your-auth-token"

    # P2P 单聊设置
    p2p:
      policy: open          # open | allowlist | disabled
      allowFrom:            # policy="allowlist" 时必填
        - "user_abc"
        - "user_xyz"

    # 群组聊天设置
    team:
      policy: open          # open | allowlist | disabled
      allowFrom:            # policy="allowlist" 时必填
        - "groupId_1"                # 该群任意发送者（高级群或超大群均匹配）
        - "groupId_2|user_abc"       # 仅 user_abc 在该群中
        - "1|groupId_3"              # 任意发送者，仅高级群
        - "2|groupId_4"              # 任意发送者，仅超大群
        - "1|groupId_5|user_xyz"     # 仅 user_xyz，仅高级群

    # 圈组设置
    qchat:
      policy: open          # open | allowlist | disabled
      allowFrom:            # policy="allowlist" 时必填
        - "serverId_1"                          # 该服务器下所有频道、所有发送者
        - "serverId_2|channelId_1"              # 该服务器+频道下所有发送者
        - "serverId_2|channelId_2|user_abc"     # 仅 user_abc 在该服务器+频道
        - "serverId_3||user_xyz"                # 仅 user_xyz 在该服务器下任意频道

    # 高级设置
    advanced:
      mediaMaxMb: 30        # 最大媒体文件大小（MB，默认 30）
      textChunkLimit: 4000  # 每条消息最大字符数（默认 4000）
      debug: false          # 启用 SDK 调试日志（默认 false）
```

### 配置参考

#### 顶层字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | boolean | `false` | 启用/禁用 NIM 渠道 |
| `appKey` | string | — | NIM 应用 AppKey（必填） |
| `account` | string | — | 机器人账号 ID（必填） |
| `token` | string | — | 认证 Token（必填） |

#### `p2p` — 单聊（私聊）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `policy` | string | `"open"` | `open` · `allowlist` · `disabled` |
| `allowFrom` | array | `[]` | 允许的发送者账号 ID（`policy="allowlist"` 时生效） |

**策略行为：**

| `policy` | `allowFrom` | 消息处理 | 好友申请自动同意 |
|----------|-------------|----------|------------------|
| `open` | 任意 | 接受所有消息 | 自动同意所有 |
| `allowlist` | 非空 | 仅接受列表中的发送者 | 仅自动同意列表中的发送者 |
| `allowlist` | 空 | 等同于 `disabled` — 拒绝所有 | 不自动同意 |
| `disabled` | 任意 | 拒绝所有消息 | 不自动同意 |

#### `team` — 群组

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `policy` | string | `"open"` | `open` · `allowlist` · `disabled` |
| `allowFrom` | array | `[]` | 白名单条目 — 格式见下方（`policy="allowlist"` 时生效） |

**策略行为：** 与 P2P 规则一致 — `allowlist` 且 `allowFrom` 为空时等同于 `disabled`。

**`team.allowFrom` 条目格式：**

| 格式 | 说明 |
|------|------|
| `"teamId"` | 该群任意发送者（高级群和超大群均匹配） |
| `"teamId\|accountId"` | 该群中指定发送者（两种群类型均匹配） |
| `"1\|teamId"` | 任意发送者，仅高级群 |
| `"2\|teamId"` | 任意发送者，仅超大群 |
| `"1\|teamId\|accountId"` | 指定发送者，仅高级群 |
| `"2\|teamId\|accountId"` | 指定发送者，仅超大群 |

#### `qchat` — 圈组

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `policy` | string | `"open"` | `open` · `allowlist` · `disabled` |
| `allowFrom` | array | `[]` | 白名单条目 — 格式见下方（`policy="allowlist"` 时生效） |

配置了 NIM 凭证后，圈组功能会自动启动。设置 `policy: "disabled"` 可完全关闭。

**策略行为：** 与 P2P 规则一致 — `allowlist` 且 `allowFrom` 为空时等同于 `disabled`。

**`qchat.allowFrom` 条目格式：**

| 格式 | 说明 |
|------|------|
| `"serverId"` | 该服务器下所有频道、所有发送者 |
| `"serverId\|channelId"` | 该服务器+频道下所有发送者 |
| `"serverId\|channelId\|accountId"` | 该服务器+频道下指定发送者 |
| `"serverId\|\|accountId"` | 该服务器下任意频道的指定发送者 |

`allowFrom` 列表（`policy="allowlist"` 时）还控制以下行为：
- **服务器订阅**：自动订阅条目中提取的服务器 ID；`policy="open"` 时自动发现所有已加入的服务器。
- **服务器邀请自动同意**：由 `policy` 控制：
  - `open` — 自动同意所有服务器邀请
  - `allowlist` — 仅自动同意 `allowFrom` 列表中服务器 ID 的邀请；空列表则拒绝所有
  - `disabled` — 不自动同意任何邀请

#### `advanced` — 高级设置

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `mediaMaxMb` | number | `30` | 最大媒体文件大小（MB） |
| `textChunkLimit` | number | `4000` | 每条消息最大字符数 |
| `debug` | boolean | `false` | 启用 SDK 调试日志 |

## 获取凭证

1. 登录[网易云信控制台](https://app.netease.im/)
2. 创建或选择应用
3. 在应用设置中复制 **AppKey**
4. 创建机器人账号并获取 **Account ID** 和 **Token**

## 启动机器人

```bash
openclaw onboard
```

## 使用

### 发送消息

```typescript
import {
  sendMessageNim,
  sendImageNim,
  sendFileNim,
  sendAudioNim,
  sendVideoNim,
} from "openclaw-nim";

// 发送文本消息
await sendMessageNim({
  cfg: openclawConfig,
  to: "user123",
  text: "Hello from NIM bot!",
});

// 发送图片（支持：.jpg, .jpeg, .png, .gif, .webp, .bmp）
await sendImageNim({
  cfg: openclawConfig,
  to: "user123",
  imagePath: "/path/to/image.png",
});

// 发送视频（支持：.mp4, .mov, .avi, .mkv, .webm, .flv）
await sendVideoNim({
  cfg: openclawConfig,
  to: "user123",
  videoPath: "/path/to/video.mp4",
  duration: 60,    // 时长（秒）
  width: 1920,
  height: 1080,
});

// 发送音频（支持：.mp3, .wav, .aac, .m4a, .ogg, .amr）
await sendAudioNim({
  cfg: openclawConfig,
  to: "user123",
  audioPath: "/path/to/audio.mp3",
  duration: 30,    // 时长（秒）
});

// 发送文件（任意文件类型）
await sendFileNim({
  cfg: openclawConfig,
  to: "user123",
  filePath: "/path/to/document.pdf",
});
```

### 目标格式

| 格式 | 说明 |
|------|------|
| `user123` | 纯账号 ID |
| `nim:user123` | 带 `nim:` 前缀 |
| `user:user123` | 带 `user:` 前缀 |

## 支持的消息类型

| 类型 | 接收 | 发送 |
|------|------|------|
| 文本 | ✅ | ✅ |
| 图片 | ✅ | ✅ |
| 文件 | ✅ | ✅ |
| 音频 | ✅ | ✅ |
| 视频 | ✅ | ✅ |
| 位置 | ✅ | ❌ |
| 自定义 | ✅ | ❌ |

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 运行测试
npm test

# 监听模式
npm run dev
```

## 许可证

MIT
