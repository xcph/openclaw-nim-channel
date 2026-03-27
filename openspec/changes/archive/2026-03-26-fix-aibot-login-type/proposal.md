# Change: Fix AI Bot Login Type

## Why

当前登录时传递 `aiBot: 1`，但 NIM SDK 约定 `aiBot` 值为 `2` 才表示 AI Bot 身份，其他值均被视为普通个人账号。这导致 bot 以普通账号身份登录，可能影响服务端对 AI Bot 的识别和消息路由。

## What Changes

- 将 `src/client.ts` 中登录选项的 `aiBot` 值从 `1` 修改为 `2`
- 在 spec 中补充 AI Bot 登录身份标识的需求说明

## Impact

- Affected specs: `nim-channel`
- Affected code: `src/client.ts` (login 方法)
