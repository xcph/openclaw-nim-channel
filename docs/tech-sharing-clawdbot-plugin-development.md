# 从零开始开发 Clawdbot Channel 插件：以网易云信 NIM 为例

> 本文将分享如何为 Clawdbot AI 机器人框架开发一个自定义渠道插件，以网易云信 (NIM) 接入为例，深入剖析插件架构、消息流转机制，以及开发过程中遇到的"坑"和解决方案。

## 背景

[Clawdbot](https://github.com/anthropics/clawdbot) 是一个强大的 AI 聊天机器人框架，支持多种消息渠道（Discord、Slack、Telegram、WhatsApp 等）。但在国内场景下，我们常常需要接入本土 IM 平台，比如网易云信。

本文将带你完整走一遍开发 NIM 渠道插件的过程，涵盖：
- 插件架构设计
- 消息收发实现
- 与 Clawdbot SDK 的深度集成
- 踩过的坑和解决方案

## 一、插件架构概览

### 1.1 目录结构

```
moltbot-nim/
├── index.ts                 # 插件入口
├── clawdbot.plugin.json     # 插件 manifest
├── package.json
└── src/
    ├── channel.ts           # 渠道插件定义 (ChannelPlugin)
    ├── client.ts            # NIM SDK 客户端封装
    ├── monitor.ts           # 消息监听模块
    ├── bot.ts               # 消息处理逻辑
    ├── reply-dispatcher.ts  # 回复分发器
    ├── send.ts              # 消息发送
    ├── media.ts             # 媒体处理
    ├── outbound.ts          # Outbound 配置
    ├── accounts.ts          # 账号管理
    ├── targets.ts           # 目标地址解析
    ├── types.ts             # 类型定义
    └── runtime.ts           # Runtime 管理
```

### 1.2 核心概念

Clawdbot 插件系统有几个核心概念需要理解：

| 概念 | 说明 |
|------|------|
| **Plugin** | 插件本体，包含 `id`、`name`、`register` 方法 |
| **ChannelPlugin** | 渠道插件，定义消息收发、账号管理等能力 |
| **RuntimeEnv** | 运行时环境，提供系统服务（日志、事件、配置等）|
| **Dispatcher** | 回复分发器，处理 AI 生成的回复消息 |

## 二、插件入口实现

### 2.1 Plugin 定义

```typescript
// index.ts
import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { emptyPluginConfigSchema } from "clawdbot/plugin-sdk";
import { nimPlugin } from "./src/channel.js";
import { setNimRuntime } from "./src/runtime.js";

const plugin = {
  id: "moltbot-nim",  // ⚠️ 必须与 package.json 的 name 一致
  name: "NIM",
  description: "NetEase IM (网易云信) channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: ClawdbotPluginApi) {
    // 保存 runtime 引用，供后续模块使用
    setNimRuntime(api.runtime);
    // 注册渠道插件
    api.registerChannel({ plugin: nimPlugin });
  },
};

export default plugin;
```

**⚠️ 踩坑点 1：Plugin ID 必须与 package.json name 一致**

如果不一致，启动时会报警告：
```
plugin id mismatch (manifest uses "nim", entry hints "moltbot-nim")
```

同时需要在 `clawdbot.plugin.json` 中声明一致的 id：
```json
{
  "id": "moltbot-nim",
  "channels": ["nim"]
}
```

### 2.2 Runtime 管理

由于插件各模块可能需要访问 Clawdbot 的 runtime 服务，我们需要一个全局管理机制：

```typescript
// src/runtime.ts
import type { RuntimeEnv } from "clawdbot/plugin-sdk";

let nimRuntime: RuntimeEnv | null = null;

export function setNimRuntime(runtime: RuntimeEnv): void {
  nimRuntime = runtime;
}

export function getNimRuntime(): RuntimeEnv {
  if (!nimRuntime) {
    throw new Error("NIM runtime not initialized");
  }
  return nimRuntime;
}
```

## 三、渠道插件实现

### 3.1 ChannelPlugin 结构

```typescript
// src/channel.ts
export const nimPlugin: ChannelPlugin<ResolvedNimAccount> = {
  id: "nim",  // Channel ID，用于消息路由
  meta: {
    label: "NIM",
    selectionLabel: "NetEase IM (网易云信)",
    blurb: "网易云信 IM 即时通讯",
    aliases: ["netease", "yunxin"],
  },
  capabilities: {
    chatTypes: ["direct"],  // 目前仅支持私聊
    media: true,
    polls: false,
    threads: false,
    reactions: false,
    edit: false,
    reply: false,
  },
  // ... 其他配置
  outbound: nimOutboundConfig,  // 消息发送配置
  gateway: {
    startAccount: async (ctx) => {
      // 启动消息监听
      return monitorNimProvider({ cfg: ctx.cfg, runtime: ctx.runtime });
    },
  },
};
```

### 3.2 Outbound 配置

Outbound 定义了消息如何发送出去：

```typescript
// src/outbound.ts
export const nimOutboundConfig = {
  deliveryMode: "gateway" as const,  // 通过 gateway 进程发送
  textChunkLimit: 5000,              // 单条消息最大字符数
  chunker: splitMessageIntoChunks,   // 长消息分割函数
  
  resolveTarget: (params) => {
    // 解析目标地址
    const normalized = normalizeNimTarget(params.to);
    return normalized 
      ? { ok: true, to: normalized }
      : { ok: false, error: "Invalid target" };
  },
  
  sendText: async (params) => {
    const result = await sendMessageNim(params);
    return { channel: "nim", ok: result.success, msgId: result.msgId };
  },
  
  sendMedia: async (params) => {
    // 发送媒体消息
  },
};
```

## 四、消息流转机制（重点！）

这是开发过程中最复杂也最容易踩坑的部分。

### 4.1 消息流转全景图

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  NIM 客户端  │───▶│   Monitor   │───▶│  handleMsg  │───▶│    Agent    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                │
                                                                ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  NIM 客户端  │◀───│  sendText   │◀───│  Dispatcher │◀───│   AI 回复   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 4.2 消息接收流程

```typescript
// src/monitor.ts
export async function monitorNimProvider(params) {
  const client = await createNimClient(nimCfg);
  await client.login();
  
  client.onMessage(async (msg) => {
    // 忽略自己发送的消息
    if (msg.from === account) return;
    
    await handleNimMessage({ cfg, runtime, message: msg });
  });
}
```

### 4.3 消息处理与分发

```typescript
// src/bot.ts
export async function handleNimMessage(params) {
  const core = getNimRuntime();
  
  // 1. 解析消息上下文
  const ctx = parseNimMessageEvent(message);
  
  // 2. 路由到对应的 Agent
  const route = core.channel.routing.resolveAgentRoute({
    cfg, channel: "nim", peer: { kind: "dm", id: ctx.senderId }
  });
  
  // 3. 创建回复分发器
  const { dispatcher, replyOptions } = createNimReplyDispatcher({
    cfg, runtime, senderId: ctx.senderId
  });
  
  // 4. 调用 Agent 处理消息并获取回复
  await core.channel.reply.dispatchReplyFromConfig({
    ctx: ctxPayload,
    cfg,
    dispatcher,
    replyOptions,
  });
}
```

### 4.4 回复分发器（Dispatcher）

**⚠️ 踩坑点 2：Dispatcher 必须使用 SDK 提供的创建函数**

最初的错误实现：
```typescript
// ❌ 错误：返回简单函数
const dispatcher = async (text: string) => {
  await sendMessageNim({ cfg, to: senderId, text });
};
```

这会导致报错：
```
TypeError: dispatcher.sendBlockReply is not a function
```

原因是 Clawdbot SDK 期望 dispatcher 是一个对象，包含 `sendBlockReply`、`sendToolResult`、`sendFinalReply` 等方法。

**正确实现：**
```typescript
// src/reply-dispatcher.ts
export function createNimReplyDispatcher(params) {
  const core = getNimRuntime();
  
  // ✅ 正确：使用 SDK 的 createReplyDispatcherWithTyping
  const { dispatcher, replyOptions, markDispatchIdle } = 
    core.channel.reply.createReplyDispatcherWithTyping({
      deliver: async (payload) => {
        // payload 是对象，不是字符串！
        const text = payload.text ?? "";
        const mediaList = payload.mediaUrls ?? [];
        
        // 发送媒体
        for (const url of mediaList) {
          await sendImageNim({ cfg, to: senderId, imagePath: url });
        }
        
        // 发送文本（自动分割长消息）
        if (text) {
          for (const chunk of splitMessageIntoChunks(text)) {
            await sendMessageNim({ cfg, to: senderId, text: chunk });
          }
        }
      },
      humanDelay: { mode: "off" },
      onError: (err) => console.error(err),
    });
  
  return { dispatcher, replyOptions, markDispatchIdle };
}
```

**⚠️ 踩坑点 3：deliver 函数的参数是 Payload 对象**

最初以为 `deliver` 接收的是 `string`：
```typescript
// ❌ 错误
deliver: async (text: string) => { ... }
```

实际上接收的是 `ReplyPayload` 对象：
```typescript
// ✅ 正确
type ReplyPayload = {
  text?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  channelData?: Record<string, unknown>;
};

deliver: async (payload: ReplyPayload) => {
  const text = payload.text ?? "";
  const mediaList = payload.mediaUrls ?? [];
  // ...
}
```

**⚠️ 踩坑点 4：必须使用正确的 Runtime 引用**

代码中有两种 "runtime"：
1. `handleNimMessage` 参数传入的 `runtime` - 简化版，只有 log/error
2. `getNimRuntime()` 返回的 `core` - 完整版，包含 `channel.reply.*`

```typescript
// ❌ 错误：使用参数传入的 runtime
runtime.channel.reply.createReplyDispatcherWithTyping(...)
// TypeError: Cannot read properties of undefined (reading 'reply')

// ✅ 正确：使用 getNimRuntime()
const core = getNimRuntime();
core.channel.reply.createReplyDispatcherWithTyping(...)
```

## 五、NIM SDK 封装

### 5.1 客户端封装

```typescript
// src/client.ts
import nim from "node-nim";

export async function createNimClient(config: NimConfig): Promise<NimClientInstance> {
  const client = new nim.NIMClient();
  
  // 初始化 SDK
  await client.init({
    appKey: config.appKey,
    // ... 其他配置
  });
  
  return {
    async login() {
      return await client.login(config.account, config.token);
    },
    
    async sendText(to: string, text: string) {
      const msg = nim.NIMMessage.createTextMessage(to, text);
      return await client.sendMessage(msg);
    },
    
    onMessage(callback: (msg: NimMessageEvent) => void) {
      client.on("message", callback);
    },
    // ...
  };
}
```

### 5.2 消息类型处理

```typescript
// src/bot.ts
function mapMessageType(msgType: number): NimMessageType {
  switch (msgType) {
    case 0: return "text";
    case 1: return "image";
    case 2: return "audio";
    case 3: return "video";
    case 6: return "file";
    default: return "unknown";
  }
}
```

## 六、配置示例

在 `clawdbot.yml` 中配置 NIM 渠道：

```yaml
plugins:
  - moltbot-nim

channels:
  nim:
    enabled: true
    appKey: "your-app-key"
    account: "bot-account-id"
    token: "bot-token"
    dmPolicy: "open"  # 或 "allowlist"
    allowFrom:
      - "user1"
      - "user2"
    mediaMaxMb: 30
    textChunkLimit: 4000
```

## 七、调试技巧

### 7.1 添加详细日志

```typescript
const deliver = async (payload: ReplyPayload) => {
  log(`nim: deliver called with text=${payload.text?.length ?? 0} chars`);
  // ...
  log(`nim: sent reply chunk (${chunk.length} chars) to ${senderId}`);
};
```

### 7.2 检查 Dispatcher 结构

如果遇到 `sendBlockReply is not a function` 错误，检查 dispatcher 是否正确创建：

```typescript
console.log("dispatcher methods:", Object.keys(dispatcher));
// 应该输出: ['sendToolResult', 'sendBlockReply', 'sendFinalReply', 'waitForIdle', 'getQueuedCounts']
```

## 八、总结

开发 Clawdbot 渠道插件的关键点：

1. **Plugin ID 一致性**：`package.json` name、`clawdbot.plugin.json` id、`plugin.id` 必须一致
2. **使用 SDK 提供的工厂函数**：`createReplyDispatcherWithTyping` 而不是自己实现
3. **正确的 Runtime 引用**：使用 `getNimRuntime()` 获取完整 runtime
4. **理解 Payload 结构**：`deliver` 接收的是对象而不是字符串
5. **充分的日志输出**：便于排查问题

希望这篇文章能帮助你快速上手 Clawdbot 插件开发，少走弯路！

---

*作者：MoltBot Team*
*日期：2026-01-29*
