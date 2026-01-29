# Tasks: MoltBot NIM 插件实现

## 1. 项目初始化

- [x] 1.1 创建项目结构和 `package.json`
- [x] 1.2 配置 TypeScript (`tsconfig.json`)
- [x] 1.3 创建 `clawdbot.plugin.json` 插件元数据
- [x] 1.4 创建 `.gitignore` 和其他配置文件

## 2. 核心类型定义

- [x] 2.1 定义 `NimConfig` 配置类型 (`src/config-schema.ts`)
- [x] 2.2 定义消息上下文类型 `NimMessageContext` (`src/types.ts`)
- [x] 2.3 定义发送结果类型 `NimSendResult` (`src/types.ts`)
- [x] 2.4 定义账户类型 `ResolvedNimAccount` (`src/types.ts`)

## 3. SDK 客户端封装

- [x] 3.1 安装并配置 NIM SDK (`node-nim` 原生 SDK)
- [x] 3.2 实现 `createNimClient` SDK 实例化函数 (`src/client.ts`)
- [x] 3.3 实现认证逻辑（AppKey + Token）(`src/accounts.ts`)
- [x] 3.4 实现客户端缓存和复用机制 (`src/client.ts`)
- [x] 3.5 实现 SDK 数据目录管理 (`~/.moltbot-nim/<account>/`)

## 4. 消息发送功能

- [x] 4.1 实现文本消息发送 `sendMessageNim` (`src/send.ts`)
- [x] 4.2 实现图片消息发送 (`src/media.ts`)
- [x] 4.3 实现文件消息发送 (`src/media.ts`)
- [x] 4.4 实现音频/视频消息发送 (`src/media.ts`)
- [x] 4.5 ~~实现消息编辑功能~~ (node-nim 不支持编辑已发送消息)

## 5. 消息接收与处理

- [x] 5.1 实现消息监听管理 (`src/monitor.ts`)
- [x] 5.2 实现消息事件回调注册 (`src/monitor.ts`)
- [x] 5.3 实现消息内容解析 `parseNimMessageEvent` (`src/bot.ts`)
- [x] 5.4 实现消息处理逻辑 `handleNimMessage` (`src/bot.ts`)
- [x] 5.5 实现媒体下载和存储 (`src/media.ts`)

## 6. 渠道插件接口

- [x] 6.1 实现 `ChannelPlugin` 接口 (`src/channel.ts`)
- [x] 6.2 实现配置解析 `resolveNimAccount` (`src/accounts.ts`)
- [x] 6.3 实现目标地址解析 `normalizeNimTarget` (`src/targets.ts`)
- [x] 6.4 实现运行时环境管理 (`src/runtime.ts`)
- [x] 6.5 实现连接状态探测 `probeNim` (`src/probe.ts`)
- [x] 6.6 实现出站消息处理 `nimOutbound` (`src/outbound.ts`)
- [x] 6.7 实现回复分发器 `createNimReplyDispatcher` (`src/reply-dispatcher.ts`)

## 7. 插件入口

- [x] 7.1 创建插件入口文件 (`index.ts`)
- [x] 7.2 导出公共 API 和类型
- [x] 7.3 实现插件注册逻辑

## 8. 测试与文档

- [ ] 8.1 编写单元测试
- [ ] 8.2 编写集成测试
- [x] 8.3 编写 README.md 文档
- [ ] 8.4 添加配置示例

## SDK 改造记录

**已从 Web SDK 改为 node-nim 原生 SDK：**
- `node-nim` ^10.9.72 - 网易云信官方 Node.js SDK
- 使用回调包装的 Promise 模式
- SDK 数据存储在 `~/.moltbot-nim/<account>/`
- 消息类型使用数值表示（0=text, 1=image, 2=audio, 3=video, 4=geo, 6=file, 100=custom）

## Dependencies

- 任务 3 依赖于任务 2 的类型定义
- 任务 4、5 依赖于任务 3 的 SDK 封装
- 任务 6 依赖于任务 4、5 的功能实现
- 任务 7 依赖于任务 6 的渠道插件

## Parallelizable

- 任务 1 和 2 可以并行
- 任务 4 和 5 可以并行（在 3 完成后）
- 任务 8 的测试可以随功能开发并行进行