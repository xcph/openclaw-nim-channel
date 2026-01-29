# Change: 修复 NIM 插件消息回复功能

## Why

当前 MoltBot 通过 NIM 渠道收到消息后能够正确处理，但 MoltBot 的回复消息无法发送到用户的 NIM 客户端。问题在于 NIM 插件的 `outbound` 配置格式不正确，导致 MoltBot 核心的回复分发系统无法正确调用 NIM 的消息发送功能。

具体问题：
- 当前 `nimPlugin.outbound` 被设置为 `nimOutbound` 函数
- 但 Clawdbot 插件 SDK 期望 `outbound` 是一个包含 `sendText`, `sendMedia`, `resolveTarget` 等方法的对象
- 参考 WhatsApp 和 Telegram 插件的实现，需要提供完整的 outbound 对象结构

## What Changes

- **修改** `src/channel.ts` - 将 `outbound` 从函数改为符合 Clawdbot SDK 规范的对象结构
- **新增** `src/outbound.ts` - 添加 `sendText`, `sendMedia`, `resolveTarget` 等方法
- **优化** `src/send.ts` - 确保发送函数返回格式与 SDK 规范一致

## Impact

- Affected specs: `nim-channel`（修改消息发送相关需求）
- Affected code:
  - `src/channel.ts` - 修改 outbound 配置
  - `src/outbound.ts` - 重构为 SDK 规范格式
  - `src/send.ts` - 调整返回值格式
