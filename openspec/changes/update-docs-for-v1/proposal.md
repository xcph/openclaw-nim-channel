# Change: 更新对外说明文档以反映 v1.0.0 新特性

## Why

最近的 4 个 commit 引入了多个重要功能和改进，需要同步更新对外说明文档（README 和 CHANGELOG，中英文版本）：

1. **流式输出支持** (a36cca9, 33e758d) - 实现了私聊(P2P)和群组(Team)的分块流式输出
2. **AI Bot 登录类型修复** (33e758d) - 将 `aiBot` 参数从 `1` 修正为 `2`，正确标识 AI Bot 身份
3. **nimToken 三合一配置** (33e758d) - 新增 `nimToken` 简化配置格式，现推荐 `appKey|accid|token`，兼容旧 `appKey-accid-token`
4. **圈组禁用流式** (3f44942) - QChat 强制禁用流式和分块，以单条完整消息形式返回
5. **多实例配置支持** (3f44942) - 支持同时运行最多 3 个 NIM 实例（不同账号/AppKey）

这些变更需要反映在用户面向的文档中，确保用户了解新功能和配置变化。

## What Changes

- **README.md 和 README.zh-CN.md**:
  - 在 Features 章节中添加流式输出和多实例支持特性
  - 更新 Configuration 章节，说明多实例数组配置格式（**BREAKING** 从单对象变为数组）
  - 添加流式输出配置说明（引用 BLOCK_STREAMING_CONFIG.md 和 STREAMING_GUIDE.md）
  - 更新快速配置示例，使用 `nimToken` 简化格式
  - 添加多实例配置示例
  - 添加圈组流式禁用的特别说明

- **CHANGELOG.md 和 CHANGELOG.zh-CN.md**:
  - 将 `[Unreleased]` 的内容（nimToken 和 aiBot 修复）移入新版本 `[1.0.0]`
  - 在 `[1.0.0]` 的 `### Added` 章节中添加：
    - 流式输出支持（私聊和群组支持分块流式，圈组强制完整消息）
    - 多实例配置支持（支持最多 3 个实例同时运行）
    - 引用 BLOCK_STREAMING_CONFIG.md 和 STREAMING_GUIDE.md 技术文档
  - 在 `[1.0.0]` 的 `### Changed` 章节中添加：
    - **BREAKING**: `channels.nim` 配置由单对象改为实例数组格式
    - 圈组(QChat)消息强制禁用流式输出和文本分块，以完整消息形式返回
  - 在 `[1.0.0]` 的 `### Fixed` 章节中保留现有的 aiBot 修复说明
  - 添加发布日期（2026-03-27）

- **配置示例格式**:
  - 所有配置示例从旧的单对象格式迁移到新的数组格式
  - 提供单实例和多实例的配置示例对比
  - 标注 BREAKING CHANGE

## Impact

- **Affected specs**: `nim-channel`（文档更新不涉及 spec 变更）
- **Affected code**: 无代码变更，仅文档更新
- **Affected files**:
  - `README.md`
  - `README.zh-CN.md`
  - `CHANGELOG.md`
  - `CHANGELOG.zh-CN.md`
- **Breaking changes**:
  1. **OpenClaw 版本要求**: 需要 OpenClaw **2026.3.24 或更新版本**（流式输出和多实例支持依赖新版 OpenClaw API）
  2. **配置格式变更**: `channels.nim` 从单对象改为实例数组格式（支持多实例配置）
  3. **账号类型限制**: 仅支持个人机器人账号登录，不支持普通个人账号
  4. **凭证配置方式**: 推荐使用 `nimToken` 三合一配置（`appKey|accid|token`，兼容旧 `appKey-accid-token`），旧的独立字段方式仍可用但不推荐
