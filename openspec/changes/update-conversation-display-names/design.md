## Context
需要通过 NIM SDK V2 的服务 API 来查询用户昵称、群名和 QChat 频道名称。这些信息在收到消息时动态查询，
并通过缓存机制减少频繁的 API 调用。

NIM Web SDK V2 提供了以下 API：
- `V2NIMUserService.getUserList(accountIds)` — 获取用户资料（包含昵称 `name`）
- `V2NIMTeamService.getTeamInfo({ teamId, teamType })` — 获取群组信息（包含群名 `name`）
- QChat 频道名称可通过 QChatClient 的频道查询 API 获取，或从消息回调的 `channelName` 字段中获取

## Goals / Non-Goals
- Goals:
  - 会话名称以 `云信·单聊·用户昵称`、`云信·群聊·群名`、`云信·圈组·频道名称` 格式显示
  - 用户名显示昵称，昵称不存在时 fallback 到 accid
  - 缓存名称查询结果，避免每条消息都调用 API
- Non-Goals:
  - 不实现实时名称变更推送（名称更新由缓存 TTL 控制）
  - 不修改消息路由和发送逻辑

## Decisions
- **名称缓存方案**: 使用内存 Map + TTL（默认 5 分钟），按 `accid`/`teamId`/`channelId` 作为 key。
  - 优点: 简单高效，避免引入外部依赖
  - 缺点: 进程重启后缓存丢失（可接受）
  - 备选方案: LRU 缓存（增加复杂度，暂不需要）

- **V2 消息中的 senderName**: NIM V2 SDK 消息对象中可能包含 `senderName` 字段。如果存在则直接使用，作为优先级最高的昵称来源，避免额外 API 调用。

- **ConversationLabel 字段**: 通过 `finalizeInboundContext` 的 `ConversationLabel` 字段设置会话名称，框架会使用该字段作为会话显示标签。

- **名称解析时机**: 在消息处理流程中同步查询（带缓存），不做异步预加载。查询失败时 fallback 到 ID。

## Risks / Trade-offs
- 首次查询用户/群名时会增加少量延迟（约 100-500ms），但缓存后后续消息不受影响
- SDK API 调用可能失败（网络问题），fallback 到 accid/teamId/channelId 确保不影响核心功能

## Open Questions
- NIM V2 SDK 的 `V2NIMMessage` 对象是否包含 `senderName` 字段？需要在实现时验证
- QChat 频道名称的最佳获取方式：消息回调是否携带频道名称？是否需要单独查询？
