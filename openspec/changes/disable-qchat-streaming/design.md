# Design: Disable QChat Streaming

## Context

OpenClaw 支持分块流式输出(block streaming),可以将 AI 生成的长回复分批发送。但在圈组(QChat)场景下,这种行为会导致消息碎片化,影响用户体验。

**当前行为**:

- `src/qchat-inbound.ts` 中的 `handleQChatInbound` 函数调用 `dispatchReplyWithBufferedBlockDispatcher` 来处理回复
- 该函数会根据全局配置 `blockStreaming` 决定是否分块发送

**目标**:

- 圈组消息始终禁用流式,一次性返回完整结果
- 私聊和群组保持原有流式行为

## Goals / Non-Goals

**Goals**:

- 圈组消息强制禁用流式输出
- 不影响私聊(P2P)和群组(Team)的流式配置
- 保持代码清晰,便于未来扩展

**Non-Goals**:

- 不提供圈组流式的配置选项(强制禁用)
- 不改变流式输出的底层实现机制

## Decisions

### Decision 1: 在 `dispatchReplyWithBufferedBlockDispatcher` 调用时传递流式和分块禁用选项

**理由**:

- OpenClaw SDK 的 `dispatchReplyWithBufferedBlockDispatcher` 函数支持覆盖全局流式配置
- 这种方式最小化代码改动,不需要修改核心流式逻辑

**实现位置**: `src/qchat-inbound.ts` L396

```typescript
await (core as any).channel.reply.dispatchReplyWithBufferedBlockDispatcher({
  ctx: ctxPayload,
  cfg: config,
  dispatcherOptions: {
    ...prefixOptions,
    deliver: deliverReply,
    disableStreaming: true, // 🔥 禁用流式输出
    textChunkLimit: Infinity, // 🔥 禁用文本分块
    chunker: undefined, // 🔥 移除分块函数
    onError: (err: unknown, info: { kind: string }) => {
      runtime.error?.(
        `[qchat] ${info.kind} reply failed — error: ${String(err)}`,
      );
    },
  },
  replyOptions: {
    onModelSelected,
  },
});
```

**Alternatives considered**:

1. ❌ 在配置层面添加 `qchat.blockStreaming` 选项 - 增加配置复杂度,与需求不符
2. ❌ 修改 `deliverQChatReply` 函数来缓冲所有块 - 实现复杂,容易出错
3. ✅ **使用 `disableStreaming` 选项** - 简单直接,符合 SDK 设计

### Decision 2: 添加日志记录以标识流式禁用

**理由**:

- 便于调试和监控
- 明确告知用户圈组消息的特殊行为

**实现**:

```typescript
runtime.log?.(
  `[qchat] streaming disabled for QChat — using complete message delivery`,
);
```

## Risks / Trade-offs

### Risk 1: 长消息可能导致延迟感知增加

**描述**: 如果 AI 生成较长回复(如 >2000 字符),用户需要等待完整生成后才能看到结果

**Mitigation**:

- 圈组场景下用户对完整消息的期望高于对实时性的要求
- 如果未来需要,可以通过配置选项允许部分圈组启用流式

### Risk 2: SDK API 变更风险

**描述**: `dispatchReplyWithBufferedBlockDispatcher` 的 API 可能在未来版本变化

**Mitigation**:

- 当前实现基于稳定的 SDK 接口
- 如果 API 变更,修改代码集中在一个函数内,易于维护

## Migration Plan

**无需迁移** - 这是行为优化,不影响配置格式和已有数据

**Rollback**:

- 如果需要回滚,移除 `disableStreaming: true` 选项即可
- 回滚不会影响数据或配置

## Open Questions

- ❓ OpenClaw SDK 的 `disableStreaming` 参数名称是否准确?需要查阅 SDK 文档确认
- ❓ 是否需要为超大型圈组(如 >1000 人)提供例外配置?

---

**实现优先级**: P0 (高) - 用户体验优化,实现简单
**预计工时**: 2-3 小时(代码修改 + 测试 + 文档更新)
