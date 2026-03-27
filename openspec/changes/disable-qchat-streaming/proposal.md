# Change: Disable Streaming for QChat Messages

## Why

圈组(QChat)场景下的流式输出存在以下问题:

- 圈组频道通常用于公开讨论,流式分块输出会导致频道内消息碎片化
- 用户期望机器人回复作为一个完整消息展示,便于阅读和引用
- 流式输出在圈组场景下会增加不必要的消息通知,影响用户体验

## What Changes

- **圈组消息**:即使全局开启 `blockStreaming`,圈组(QChat)消息也强制禁用流式和文本分块,一次性返回完整结果
- **私聊和群组**:保持流式配置和分块配置不变,继续支持分块流式输出
- **配置优先级**:圈组的流式和分块行为由代码强制控制,不受配置文件影响

## Impact

- **Affected specs**: `nim-channel`
- **Affected code**:
  - `src/qchat-inbound.ts` - 修改 `dispatchReplyWithBufferedBlockDispatcher` 调用,为圈组消息强制禁用流式
  - `src/channel.ts` (可能) - 如果需要在渠道层面统一处理流式配置
- **Breaking changes**: 无破坏性变更,仅改变圈组消息的输出行为
