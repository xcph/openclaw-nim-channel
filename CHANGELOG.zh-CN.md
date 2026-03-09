# 更新日志

[English](./CHANGELOG.md) | 中文

本文件记录项目的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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
- 包名从 `moltbot-nim` 更名为 `openclaw-nim`
- 插件 ID 变更为 `openclaw-nim`
- 数据目录从 `~/.moltbot-nim` 变更为 `~/.openclaw-nim`

---

## 预发布历史（moltbot-nim 时期）

### [0.1.x] - 2026-01

- `moltbot-nim` 初始开发
- 基础 NIM SDK 集成
- 渠道插件架构
