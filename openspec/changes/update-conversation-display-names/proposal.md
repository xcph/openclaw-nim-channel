# Change: 优化会话名称和用户名显示

## Why
当前会话名称格式为 `nim:direct:accid·accid`，用户名也直接显示 accid，不够友好。需要改为：
- 单聊：`云信·单聊·用户昵称`
- 群聊：`云信·群聊·群名`
- 圈组：`云信·圈组·频道名称`

同时，用户名应显示昵称（nickname），昵称不存在时 fallback 到 accid。

## What Changes
- 新增名称解析模块 `src/name-resolver.ts`，通过 NIM SDK V2 API 查询用户昵称、群名和 QChat 频道名称，并实现缓存机制
- 修改 `src/types.ts`，在 `NimMessageEvent` 中增加 `fromNick` 可选字段
- 修改 `src/client.ts` 的 `convertV2ToMessageEvent` 函数，从 V2 消息对象中提取 `senderName`（如果 SDK 提供）
- 修改 `src/bot.ts` 的 `handleNimMessage`，为 inbound context 设置 `ConversationLabel` 和 `SenderName` 为友好名称
- 修改 `src/qchat-inbound.ts` 的 `handleQChatInbound`，将 `ConversationLabel` 格式改为 `云信·圈组·频道名称`
- 修改 `src/client.ts`，暴露 `V2NIMUserService` 和 `V2NIMTeamService` 供名称解析模块使用

## Impact
- Affected specs: `nim-channel`
- Affected code:
  - `src/name-resolver.ts`（新增）
  - `src/types.ts`（增加 `fromNick` 字段）
  - `src/client.ts`（提取 nick、暴露 user/team service）
  - `src/bot.ts`（设置 ConversationLabel 和 SenderName）
  - `src/qchat-inbound.ts`（更新 ConversationLabel 格式）
