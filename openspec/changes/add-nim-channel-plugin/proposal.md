# Change: 实现基于网易云信IM的MoltBot插件

## Why

MoltBot 是一个多渠道智能机器人框架，当前已支持飞书等渠道。为了扩展 MoltBot 的覆盖范围，需要为网易云信 IM（NIM）开发一个新的渠道插件，使用户可以通过网易云信 IM 客户端与 AI 机器人进行交互。

## What Changes

- 新增 `moltbot-nim` 渠道插件，支持网易云信 IM 平台
- 实现 WebSocket 长连接，接收和处理 IM 消息
- 支持私聊/单聊会话类型
- 支持多种消息类型（文本、图片、文件、音频、视频等）
- 使用 AppKey + Token 认证机制
- 适配 Web/JS SDK 在 Node.js 环境下运行
- 遵循 Clawdbot 插件 SDK 接口规范

## Impact

- Affected specs: `nim-channel`（新增）
- Affected code:
  - `index.ts` - 插件入口
  - `src/channel.ts` - 渠道插件定义
  - `src/client.ts` - NIM SDK 客户端封装
  - `src/send.ts` - 消息发送逻辑
  - `src/monitor.ts` - WebSocket 连接监听
  - `src/bot.ts` - 消息处理逻辑
  - `src/types.ts` - 类型定义
  - `src/accounts.ts` - 账户配置解析
  - `src/config-schema.ts` - 配置验证
  - `src/media.ts` - 媒体文件处理
  - `src/targets.ts` - 目标地址解析
  - `src/runtime.ts` - 运行时环境
  - `src/probe.ts` - 连接状态探测
  - `src/outbound.ts` - 出站消息处理
  - `package.json` - 依赖配置
  - `clawdbot.plugin.json` - 插件元数据
