# Change: 消息发送者显示去除账号，仅显示昵称

## Why
当前 OpenClaw UI 在消息下方同时显示发送者昵称（`SenderName`）和账号（`SenderId`/accid），导致界面冗余。用户希望：有昵称时只显示昵称；没有昵称时才显示账号。

## What Changes
- 修改 `src/bot.ts`：P2P 和 Team 场景下，`SenderId` 由始终填 accid，改为「有昵称填昵称，无昵称才填 accid」
- 修改 `src/qchat-inbound.ts`：QChat 场景下，`SenderId` 采用相同逻辑

## Impact
- Affected specs: `nim-channel`
- Affected code:
  - `src/bot.ts`（修改 `SenderId` 赋值）
  - `src/qchat-inbound.ts`（修改 `SenderId` 赋值）
