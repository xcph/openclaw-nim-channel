## 1. 修改 P2P 和 Team 场景（bot.ts）

- [x] 1.1 修改 `src/bot.ts` 中 `finalizeInboundContext` 的 `SenderId` 赋值：  
      由 `ctx.senderId` 改为 `senderDisplayName !== ctx.senderId ? senderDisplayName : ctx.senderId`，  
      即有昵称（senderDisplayName 不等于 accid）时用昵称，否则用 accid

## 2. 修改 QChat 场景（qchat-inbound.ts）

- [x] 2.1 修改 `src/qchat-inbound.ts` 中 `finalizeInboundContext` 的 `SenderId` 赋值：  
      由 `message.senderAccid` 改为 `senderDisplay !== message.senderAccid ? senderDisplay : message.senderAccid`，  
      即有昵称时用昵称，否则用 accid

## 3. 验证

- [ ] 3.1 手动验证：有昵称的用户发消息，消息下方只显示昵称，不显示账号
- [ ] 3.2 手动验证：无昵称的用户发消息，消息下方显示账号（fallback 正常）
- [ ] 3.3 覆盖 P2P、Team、QChat 三个场景

## Dependencies

- 任务 1 和任务 2 独立，可并行
- 任务 3 依赖任务 1 和 2
