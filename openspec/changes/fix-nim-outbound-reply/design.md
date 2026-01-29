## Context

MoltBot 使用 Clawdbot 插件 SDK 实现多渠道机器人。每个渠道插件需要实现特定的接口来支持消息收发。当前 NIM 插件的 `outbound` 配置格式不符合 SDK 规范，导致回复功能不工作。

本次变更参考 WhatsApp 和 Telegram 插件的实现，将 NIM 插件的 outbound 从简单的函数改为完整的配置对象。

## Goals / Non-Goals

### Goals
- 使 MoltBot 处理消息后能够正确回复到 NIM 客户端
- 符合 Clawdbot 插件 SDK 的 outbound 接口规范
- 保持与现有消息接收流程的兼容性

### Non-Goals
- 不改变现有的消息接收逻辑
- 不添加新的消息类型支持
- 不修改 node-nim SDK 的使用方式

## Decisions

### Decision 1: 使用 "gateway" 交付模式
- **What**: 设置 `deliveryMode: "gateway"`
- **Why**: NIM 插件通过 gateway 管理长连接和消息监听，与 WhatsApp 类似

### Decision 2: outbound 对象结构
```typescript
outbound: {
  deliveryMode: "gateway",
  chunker: splitMessageIntoChunks,
  textChunkLimit: 5000,
  resolveTarget: ({ to, allowFrom, mode }) => { ... },
  sendText: async ({ to, text, ... }) => { ... },
  sendMedia: async ({ to, text, mediaUrl, ... }) => { ... },
}
```

### Alternatives Considered
1. **继续使用 nimOutbound 函数** - 不可行，不符合 SDK 规范
2. **使用 "direct" 交付模式** - 不合适，NIM 需要长连接管理

## Risks / Trade-offs

1. **风险**: node-nim SDK 的 sendMessage API 可能有延迟
   - **缓解**: 已有的登录状态检查和重连逻辑可以处理
   
2. **风险**: conversationId 构建逻辑可能需要调整
   - **缓解**: 复用现有的 `buildConversationId` 工具函数

## Migration Plan

无迁移需求，这是 bug 修复。

## Open Questions

1. 是否需要支持 `deliveryMode: "direct"` 作为备选？
2. 是否需要添加重试逻辑到 outbound.sendText？
