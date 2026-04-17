# Change: 支持 NIM 通道多实例配置

## Why

目前 `channels.nim` 只允许配置一个账号，无法满足以下场景：

- 同一 appKey 下需要多个机器人账号（例如不同功能的 bot）
- 不同 appKey 的多个机器人实例同时运行

## What Changes

- `channels.nim` 由单一对象改为**实例数组**，每个元素是完整独立的实例配置
- 每个实例无需手动指定 `id`，系统内部自动以 `appKey:accid` 作为唯一标识（`accountId`）
- 每个实例包含凭证 (`nimToken` 或 `appKey`/`account`/`token`) 及子配置 (`p2p`、`team`、`qchat`、`advanced`)
- 插件启动时依次启动所有 `enabled: true` 的实例，每个实例独立建立 WebSocket 连接
- 入站消息按照接收实例的登录账号路由，发送回复也使用对应实例的连接
- 总实例数上限为 **3**（`enabled` 或 `disabled` 均计入总数，验证在配置解析时进行）
- 每个实例的 SDK 数据目录使用 `~/.openclaw-nim/<account>/` 路径（与现有规则一致）
- 提供向后兼容：若 `channels.nim` 仍为旧式单对象格式，插件应提示用户迁移至数组格式（**BREAKING**：运行时不自动降级，强制要求数组格式）

## Impact

- Affected specs: `nim-channel`
- Affected code:
  - `src/config-schema.ts` — NimConfigSchema 改为数组 schema，新增 NimInstanceConfigSchema
  - `src/accounts.ts` — listAccountIds、resolveNimAccount 改为多实例版本
  - `src/channel.ts` — reload prefixes、config.\*、gateway.startAccount 改为多实例感知
  - `src/monitor.ts` — monitorNimProvider 支持多实例并发
  - `src/bot.ts` / `src/outbound.ts` / `src/send.ts` — accountId 路由到正确实例
  - `src/qchat-send.ts` / `src/qchat-client.ts` — 改为 Map 存储多实例 QChat 客户端
