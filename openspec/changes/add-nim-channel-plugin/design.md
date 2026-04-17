# Design: MoltBot NIM 插件技术设计

## Context

MoltBot NIM 插件是一个基于网易云信 IM SDK 的渠道插件，需要在 Node.js 环境下运行。

**利益相关者**：
- 使用网易云信 IM 的企业用户
- MoltBot 平台运营团队
- AI Agent 开发者

**技术约束**：
- 需要原生 Node.js 支持，避免浏览器 polyfill 的复杂性
- 需要保持 WebSocket 长连接稳定，支持断线重连
- 消息处理需要异步非阻塞

## Goals / Non-Goals

### Goals
- 实现稳定的消息收发
- 支持私聊消息类型
- 支持多媒体消息（图片、文件、音频、视频）
- 遵循 Clawdbot 插件 SDK 接口规范
- 提供简洁的配置接口

### Non-Goals
- 不支持群聊功能（首期）
- 不实现音视频通话功能
- 不处理聊天室场景
- 不实现完整的好友/联系人管理

## Decisions

### 1. SDK 选择

**决定**：使用 `node-nim`（网易云信官方 Node.js SDK，基于 C++ SDK 原生封装）。

**历史决策**：
- 最初考虑使用 `nim-web-sdk-ng`（Web SDK），但需要大量浏览器 polyfill，兼容性问题多
- 后改为使用 `node-nim`，这是官方的 Node.js 原生 SDK，性能更好，API 更稳定
- 最终迁移到 `@yxim/nim-bot`，这是网易云信官方 IM Bot SDK

**备选方案考虑**：
| 方案 | 优点 | 缺点 |
|------|------|------|
| @yxim/nim-bot (✅ 选用) | 官方 Bot SDK，专为 Bot 场景设计 | — |
| node-nim | 原生 SDK，性能好，官方维护 | 需要原生编译 |
| nim-web-sdk-ng (已废弃) | 纯 JS，跨平台 | 需要 polyfill，Node.js 兼容性问题，已停止维护 |
| HTTP API | 简单，无状态 | 实时性差，需要轮询 |

**理由**：`@yxim/nim-bot` 是网易云信官方 IM Bot SDK，专为机器人场景优化，API 简洁稳定。

### 2. 架构模式

**决定**：采用与 moltbot-feishu 一致的模块化架构。

```
src/
├── channel.ts      # 渠道插件定义（ChannelPlugin 接口）
├── client.ts       # NIM SDK 客户端封装
├── send.ts         # 消息发送
├── monitor.ts      # 消息监听
├── bot.ts          # 消息处理逻辑
├── types.ts        # 类型定义
├── accounts.ts     # 账户配置
├── media.ts        # 媒体处理
├── targets.ts      # 目标解析
├── runtime.ts      # 运行时管理
├── probe.ts        # 状态探测
├── outbound.ts     # 出站消息
└── config-schema.ts # 配置验证
```

**理由**：复用 feishu 插件的成熟架构，降低开发和维护成本。

### 3. 认证机制

**决定**：使用 AppKey + Account + Token 三元组认证。

配置结构：
```typescript
interface NimConfig {
  enabled: boolean;
  appKey: string;      // 应用 AppKey
  account: string;     // 机器人账号 ID
  token: string;       // 认证 Token
  // ... 其他配置
}
```

**理由**：这是网易云信标准的认证方式，安全可靠。

### 4. 消息处理流程

```
接收消息 → 解析消息 → 权限检查 → 构建上下文 → 分发给 Agent → 获取回复 → 发送响应
```

关键回调事件（node-nim SDK）：
- `talk.on("receiveMsg")`: 收到消息
- `client.on("kickout")`: 被踢下线
- `client.on("disconnect")`: 断开连接

### 5. 媒体处理策略

**决定**：
- 下载媒体文件到临时目录
- 使用标准 HTTP/HTTPS 下载附件 URL
- 发送媒体使用 SDK 的 `sendMsg` API，通过 `msg_attach` 字段传递文件路径

**限制**：
- 默认最大 30MB 媒体文件
- 支持图片、文件、音频、视频等类型

### 6. SDK 数据存储

**决定**：SDK 数据存储在 `~/.moltbot-nim/<account>/` 目录。

**理由**：
- 用户目录隔离，支持多账号
- 避免与其他应用数据冲突
- 便于清理和备份

## Risks / Trade-offs

### 风险 1: 原生 SDK 跨平台编译
- **风险**：node-nim 需要原生编译，不同平台可能有兼容问题
- **缓解**：npm 包已提供预编译的二进制文件，支持 Windows/macOS/Linux

### 风险 2: 连接稳定性
- **风险**：网络波动导致断连
- **缓解**：SDK 内置重连机制；增加状态监控和日志

### 风险 3: Token 过期处理
- **风险**：长时间运行后 Token 失效
- **缓解**：监听 kickout 事件，支持重新登录

## Migration Plan

本插件为新增功能，无需迁移。部署步骤：

1. 安装插件包（会自动下载原生 SDK 二进制）
2. 配置 `channels.nim` 凭据
3. 启动服务，验证连接
4. 测试消息收发

## Open Questions

1. **~~SDK 版本选择~~**：已确定使用 node-nim ^10.9.72
2. **多账号支持**：是否需要支持一个插件管理多个机器人账号？（首期单账号）
3. **消息撤回**：是否需要支持消息撤回功能？
4. **已读回执**：是否需要处理已读回执事件？