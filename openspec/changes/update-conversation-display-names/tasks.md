# Tasks: 优化会话名称和用户名显示

## 1. 名称解析模块

- [x] 1.1 创建 `src/name-resolver.ts`，实现带 TTL 缓存的名称查询基础框架
- [x] 1.2 实现 `resolveUserNick(nim, accid)` — 通过 `V2NIMUserService.getUserList` 查询用户昵称，昵称不存在时返回 accid
- [x] 1.3 实现 `resolveTeamName(nim, teamId, sessionType)` — 通过 `V2NIMTeamService` 查询群名，查询失败时返回 teamId
- [x] 1.4 实现 `resolveQChatChannelName(qchatClient, serverId, channelId)` — 查询圈组频道名称，查询失败时返回 `serverId:channelId`

## 2. SDK 客户端适配

- [x] 2.1 修改 `src/types.ts`，在 `NimMessageEvent` 接口中增加 `fromNick?: string` 可选字段
- [x] 2.2 修改 `src/client.ts` 的 `convertV2ToMessageEvent` 函数，从 V2 消息对象中提取 `senderName` 到 `fromNick` 字段
- [x] 2.3 修改 `src/client.ts` 的 `NimClientInstance` 接口和实现，暴露 `nativeNim` 上的 `V2NIMUserService` 和 `V2NIMTeamService`（或直接复用 `nativeNim`）

## 3. P2P 单聊会话名称

- [x] 3.1 修改 `src/bot.ts` 的 `handleNimMessage`，在 P2P 场景下查询用户昵称
- [x] 3.2 设置 `SenderName` 为用户昵称（fallback 到 accid）
- [x] 3.3 设置 `ConversationLabel` 为 `云信·单聊·{用户昵称}`

## 4. Team 群聊会话名称

- [x] 4.1 修改 `src/bot.ts` 的 `handleNimMessage`，在 Team 场景下查询群名和发送者昵称
- [x] 4.2 设置 `SenderName` 为发送者昵称（fallback 到 accid）
- [x] 4.3 设置 `ConversationLabel` 为 `云信·群聊·{群名}`
- [x] 4.4 设置 `GroupSubject` 为群名（fallback 到 teamId）

## 5. QChat 圈组会话名称

- [x] 5.1 修改 `src/qchat-inbound.ts` 的 `handleQChatInbound`，查询频道名称
- [x] 5.2 设置 `ConversationLabel` 为 `云信·圈组·{频道名称}`
- [x] 5.3 `SenderName` 已使用 `senderNick ?? senderAccid`，确认无需修改

## 6. 验证与测试

- [ ] 6.1 手动验证单聊场景：会话名称显示为 `云信·单聊·用户昵称`
- [ ] 6.2 手动验证群聊场景：会话名称显示为 `云信·群聊·群名`
- [ ] 6.3 手动验证圈组场景：会话名称显示为 `云信·圈组·频道名称`
- [ ] 6.4 验证昵称不存在时 fallback 到 accid
- [ ] 6.5 验证 SDK API 调用失败时 fallback 到 ID

## Dependencies

- 任务 2 可与任务 1 并行
- 任务 3、4 依赖于任务 1 和 2
- 任务 5 依赖于任务 1
- 任务 6 依赖于任务 3、4、5