# 更新日志

[English](./CHANGELOG.md) | 中文

本文件记录项目的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布]

## [1.0.2] - 2026-04-01

### 修复

- 修复 OpenClaw 2026.3.28 上安装插件失败的问题：`npm install failed` + `package.json missing openclaw.hooks`
- 通过 `bundledDependencies` 打包运行时依赖（`@yxim/nim-bot`、`zod`），消除隔离安装时对外部 npm registry 的依赖
- 移除 `peerDependencies` 中的 `openclaw` 声明，避免 OpenClaw 沙盒安装环境中的 peer dependency 解析失败

## [1.0.0] - 2026-03-27

### 新增

- **流式输出支持**：私聊和群组消息支持分块流式输出，实现实时响应传递；圈组消息使用完整消息传递（强制禁用流式以避免碎片化）
- **多实例配置**：支持同时运行最多 3 个 NIM 实例，使用不同账号或 AppKey；每个实例保持独立连接和策略
- `nimToken` 三合一凭证配置：支持 `appKey-accid-token` 格式，简化配置流程，优先于独立的 `appKey`/`account`/`token` 字段（推荐）
- 技术文档：[`BLOCK_STREAMING_CONFIG.md`](./BLOCK_STREAMING_CONFIG.md) 分块流式配置指南和 [`STREAMING_GUIDE.md`](./STREAMING_GUIDE.md) 实时流式数据使用说明

### 变更

- **破坏性变更**：需要 OpenClaw **2026.3.24 或更新版本**（流式输出和多实例支持需要新版本）
- **破坏性变更**：`channels.nim` 配置从单对象改为**数组格式**以支持多实例
- **破坏性变更**：仅支持**机器人账号**，不再支持普通个人账号
- **破坏性变更**：推荐使用 `nimToken` 三合一配置（`appKey-accid-token`）；独立的 `appKey`/`account`/`token` 字段已弃用但仍可用
- 圈组消息强制禁用流式输出和文本分块，以完整消息形式传递（避免圈组内消息碎片化）

### 修复

- 登录时 `aiBot` 参数从 `1` 修正为 `2`，确保以 AI Bot 身份登录

## [0.4.0] - 2026-03-18

### 新增

- **名称解析模块**（`name-resolver.ts`）：通过 NIM SDK V2 API 解析用户昵称、群名称、圈组频道名称，内置内存 TTL 缓存（5 分钟）
- 会话标签现在显示可读名称：`云信·单聊·<昵称>`、`云信·群聊·<群名>`、`云信·圈组·<频道名>` 替代原始 ID
- `NimMessageEvent` 新增 `fromNick` 字段 — 直接从 SDK 消息对象提取发送者昵称
- `QChatInboundMessage` 新增 `mentionAccids` 字段 — 暴露消息中 @提及的账号 ID 列表
- 圈组入站消息 @提及解析：在分发给 Agent 前，将消息体中的 `@accid` 替换为 `@昵称`
- 圈组入站系统事件，使用解析后的显示名称（与 bot.ts 保持一致）
- 通过 `core.channel.session.recordInboundSession()` 记录 NIM 单聊和群聊的入站会话

### 变更

- **破坏性变更：** 回复分发从 `createNimReplyDispatcher` + `dispatchReplyFromConfig` 迁移至 `createNormalizedOutboundDeliverer` + `dispatchReplyWithBufferedBlockDispatcher`（与圈组模式对齐）
- **破坏性变更：** 单聊和群聊统一使用 `ChatType: "direct"` 和 `PeerKind: "dm"`；群聊 peer ID 添加 `team-` 前缀以区分
- **破坏性变更：** 圈组入站 `ChatType` 从 `"group"` 变更为 `"direct"`；peer ID 添加 `qchat-` 前缀；圈组上下文载荷移除 `GroupSubject`
- **破坏性变更：** 圈组 `From` 字段从 `nim:qchat:<accid>` 简化为 `nim:<accid>`
- `SenderName` 现在显示解析后的昵称而非原始账号 ID
- `ConversationLabel` 使用可读的会话标签（如 `云信·群聊·<名称>`）替代原始 ID
- bot.ts 中移除 Agent 信封格式化 — `Body` 直接传递原始文本
- 系统事件标签使用解析后的显示名称

### 移除

- 不再使用 `reply-dispatcher.ts` — 由内联的 `createNormalizedOutboundDeliverer` 替代
- 系统事件标签中移除消息内容预览（隐私保护）

## [0.4.0-beta.3] - 2026-03-12

### 变更

- 修正 README 中 `link_web` 示例值：从 `wss://your-link.example.com` 改为 `weblink.netease.im:443`，与 NIM SDK 预期格式（host:port）一致

## [0.4.0-beta.2] - 2026-03-10

### 新增

- README 中新增私有化部署 CLI 配置示例 — 为所有私有化字段添加 `openclaw config set` 命令示例（`weblbsUrl`、`link_web`、`nos_uploader`、`nos_downloader_v2`、`nosSsl`、`nos_accelerate`、`nos_accelerate_host`）

## [0.4.0-beta.1] - 2026-03-09

### 新增

- 私有化部署配置（基于 `NIMOtherOptionsPrivateConfig`）：支持自定义 LBS 地址（`weblbsUrl`）、WebSocket 连接地址（`link_web`）、NOS 上传地址（`nos_uploader`）、NOS 下载地址格式（`nos_downloader_v2`）、NOS HTTPS 开关（`nosSsl`）、CDN 加速 URL（`nos_accelerate`）、CDN 加速域名（`nos_accelerate_host`）
- 所有私有化参数均在 `advanced` 配置下暴露，数据上报字段（`compassDataEndpoint`、`enableCompass`）已排除

### 变更

- README 中的配置示例从 YAML 格式改为 JSON 格式，与 OpenClaw 实际配置格式保持一致

## [0.3.0-beta.6] - 2026-03-06

### 新增

- 圈组（`qchat`）策略系统：`open` / `allowlist` / `disabled`，支持细粒度 `allowFrom` 条目格式：`serverId`、`serverId|channelId`、`serverId|channelId|accountId`、`serverId||accountId`
- 圈组服务器邀请自动同意，由 `qchat.policy` 和 `allowFrom` 控制
- 圈组回复消息支持（回复时引用原始消息）
- 群组（`team`）策略，支持按群 ID + 发送者白名单，区分高级群和超大群类型过滤
- 圈组投递时二次策略检查 — 防止配置变更期间进行中的消息绕过策略
- `qchat-send.ts` 发送硬门控（`qchatReplyEnabled`）— 策略禁用时阻止所有出站发送
- 中文 README（`README.zh-CN.md`），与英文版互相链接

### 变更

- **破坏性变更：** 配置结构重组 — `p2pPolicy`/`allowFrom`/`teamPolicy`/`teamAllowFrom`/`mediaMaxMb`/`textChunkLimit`/`debug` 移入嵌套的 `p2p`、`team`、`advanced`、`qchat` 子对象
- **破坏性变更：** 圈组配置简化 — 移除 `qchat.enabled`、`qchat.serverIds`、`qchat.serverPolicy`；替换为 `qchat.policy` + `qchat.allowFrom`
- 配置 NIM 凭证后圈组自动启动（不再需要 `qchat.enabled: true`）
- 订阅的服务器 ID 自动从 `qchat.allowFrom` 条目中派生
- 好友申请自动同意现通过 `updateP2pPolicy()` 在配置重载时更新，不再使用过期的闭包值
- 从 `[nim] sending reply` 日志中移除消息内容（文本预览），保护隐私

### 修复

- **圈组消息在策略阻止后仍被处理**：闭包在启动时捕获 `qchatPolicy` 且在配置重载时不更新，导致旧网关实例以过期的 `policy: open` 继续分发消息
- **配置重载导致圈组监听器累积**：`stop()` 仅取消服务器订阅但未移除 `nim.qchatMsg.on("message")` 事件监听器，导致同一消息被共享 NIM SDK 实例上的新旧监听器重复处理
- **空 `allowFrom` 的 `allowlist` 被当作 `open` 处理**：圈组服务器邀请的 `serverPolicy` 通过 `derivedServerIds.length > 0` 推导而非使用实际的 `qchat.policy` 值 — `disabled` 和空列表的 `allowlist` 均错误地解析为 `"open"`
- **空 `allowFrom` 的 `allowlist` 仍启用回复**：`setQchatReplyEnabled()` 仅检查字面量 `"disabled"`，未处理空列表的 `"allowlist"`
- **投递时二次检查仅捕获 `disabled`**：圈组投递门控检查 `livePolicy === "disabled"` 但遗漏了空列表的 `"allowlist"`；现使用完整的 `isQChatAllowed()` 检查
- **好友申请自动同意使用过期配置**：`p2pPolicy` 和 `allowFrom` 在 `createNimClient` 闭包中仅捕获一次，配置重载时不更新（NIM 客户端有缓存）
- **P2P 空 `allowFrom` 的 `allowlist` 未视为禁用**：`isNimP2pAllowed()` 中缺少空列表的提前返回
- **群组策略缺少 `isTeam` 判断**：群组策略检查无条件执行，未判断会话类型

## [0.0.3] - 2026-02-03

### 修复

- 修复插件 SDK 导入路径：`clawdbot/plugin-sdk` → `openclaw/plugin-sdk`
- 修复类型引用：`ClawdbotConfig` → `OpenClawConfig`
- 修复类型引用：`ClawdbotPluginApi` → `OpenClawPluginApi`

## [0.0.2] - 2026-02-03

### 修复

- 添加 `openclaw.plugin.json` 清单文件（从 `clawdbot.plugin.json` 重命名）

## [0.0.1] - 2026-02-03

### 新增

- 首次发布 `openclaw-nim`（从 `moltbot-nim` 更名）
- 网易云信（NIM）OpenClaw 渠道插件
- 消息收发支持
- 媒体文件处理（图片、音频、视频、文件）
- 长消息自动分片
- 私聊（DM）策略配置
- 通过配置支持多账号
- Zod schema 校验，支持数字字符串自动转换

### 变更

openclaw.plugin.json`清单文件（从`clawdbot.plugin.json` 重命名）

## [0.0.1] - 2026-02-03

### 新增

- 首次发布 `openclaw-nim`（从 `moltbot-nim` 更名）
- 网易云信（NIM）OpenClaw 渠道插件
- 消息收发支持
- 媒体文件处理（图片、音频、视频、文件）
- 长消息自动分片
- 私聊（DM）策略配置
- 通过配置支持多账号
- Zod schema 校验，支持数字字符串自动转换

### 变更

- 包名从 `moltbot-nim` 更名为 `openclaw-nim`
- 插件 ID 变更为 `openclaw-nim`
- 数据目录从 `~/.moltbot-nim` 变更为 `~/.openclaw-nim`

---

## 预发布历史（moltbot-nim 时期）

### [0.1.x] - 2026-01

- `moltbot-nim` 初始开发
- 基础 NIM SDK 集成
- 渠道插件架构
