# Change: 重命名项目为 OpenClaw NIM Plugin

## Why

Clawdbot/MoltBot 已正式更名为 OpenClaw，需要同步更新本插件的命名以保持品牌一致性。

## What Changes

- 包名从 `moltbot-nim` 改为 `openclaw-nim`
- 描述性文字从 "MoltBot" 改为 "OpenClaw"
- 数据目录从 `~/.moltbot-nim/` 改为 `~/.openclaw-nim/`
- 更新 README、技术文档中的所有相关描述
- **保持** `clawdbot` 依赖包名不变（底层 SDK 未改名）

## Impact

- Affected specs: `nim-channel`
- Affected code: 
  - `package.json` - 包名和描述
  - `clawdbot.plugin.json` - 插件 ID
  - `index.ts` - 插件注册 ID
  - `src/client.ts` - 数据目录路径
  - `README.md` - 文档描述
  - `docs/tech-sharing-clawdbot-plugin-development.md` - 技术文档
  - `openspec/project.md` - 项目描述
  - `openspec/changes/*/` - 历史 change 文档（参考更新）
