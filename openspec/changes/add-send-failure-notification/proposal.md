# Change: 消息发送失败时自动通知用户

## Why

当消息发送失败时（如错误码 195002 参数错误），用户无法感知发送失败，体验不佳。需要在消息发送失败时自动向用户发送一条错误提示消息，告知用户发送失败的原因。

## What Changes

- 当消息发送失败时，自动向原接收者重发一条提示消息，内容为 `消息发送失败：错误码描述(错误码)`
- 错误描述获取优先级：
  1. SDK 运行时返回的 `error.message` 或 `error.desc`（最准确）
  2. SDK 提供的 `V2NIMErrorDesc[errorCode]` 错误码映射表
  3. 默认值"发送失败"
- 重发的错误提示消息如果也失败，不再重试（避免死循环）
- 通知消息直接调用 client.sendText，绕过 outbound 层防止递归
- 适用于所有会话类型（P2P、群聊、超级群等）

## Impact

- Affected specs: `specs/nim-channel`
- Affected code: `src/send.ts`, `src/outbound.ts`
