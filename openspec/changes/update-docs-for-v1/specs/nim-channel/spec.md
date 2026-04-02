## MODIFIED Requirements

### Requirement: 文档反映实际功能

用户面向的文档（README 和 CHANGELOG）MUST 准确反映插件的当前功能和配置方式，包括新增的流式输出、多实例配置、nimToken 简化凭证等特性。

#### Scenario: README 包含版本要求说明

- **WHEN** 用户查看 README
- **THEN** 应明确说明需要 OpenClaw 2026.3.24 或更新版本
- **AND** 应说明版本要求的原因（流式输出和多实例支持依赖新版 API）

#### Scenario: README 包含账号类型限制说明

- **WHEN** 用户查看 README 或 Getting Credentials 章节
- **THEN** 应明确说明仅支持个人机器人账号登录
- **AND** 应说明不支持普通个人账号
- **AND** 应指导用户创建机器人账号

#### Scenario: README 推荐 nimToken 三合一配置

- **WHEN** 用户查看配置说明
- **THEN** 应优先展示 `nimToken` 格式（`appKey|accid|token`）
- **AND** 应说明这是推荐的配置方式
- **AND** 应说明旧的 `appKey-accid-token` 和独立字段方式仍可用但不推荐

#### Scenario: README 包含流式输出说明

- **WHEN** 用户查看 README Features 章节
- **THEN** 应看到流式输出的功能说明
- **AND** 应说明私聊和群组支持流式，圈组强制完整消息

#### Scenario: README 包含多实例配置说明

- **WHEN** 用户查看 README Configuration 章节
- **THEN** 应看到多实例数组配置格式的说明
- **AND** 应有单实例和多实例的配置示例
- **AND** 应包含 BREAKING CHANGE 警告

#### Scenario: README 包含 nimToken 简化配置

- **WHEN** 用户查看快速配置示例
- **THEN** 应看到 `nimToken` 格式为 `appKey|accid|token`
- **AND** 应说明此格式优先于独立字段
- **AND** 应说明旧格式 `appKey-accid-token` 仍兼容

#### Scenario: README 配置示例使用数组格式

- **WHEN** 用户查看完整配置示例
- **THEN** `channels.nim` 应为数组格式，而非单对象
- **AND** 数组中每个实例应包含 `enabled` 字段

#### Scenario: CHANGELOG 记录 v1.0.0 变更

- **WHEN** 用户查看 CHANGELOG
- **THEN** 应有 `[1.0.0] - 2026-03-27` 版本章节
- **AND** 应在 `### Added` 中列出流式输出和多实例支持
- **AND** 应在 `### Changed` 中标注配置格式 BREAKING CHANGE
- **AND** 应在 `### Fixed` 中包含 aiBot 参数修复

#### Scenario: 中英文文档内容一致

- **WHEN** 用户对比 README.md 和 README.zh-CN.md
- **THEN** 功能说明和配置示例应在语义上一致
- **WHEN** 用户对比 CHANGELOG.md 和 CHANGELOG.zh-CN.md
- **THEN** 版本变更记录应在内容上一致

#### Scenario: 流式输出文档引用技术指南

- **WHEN** 用户查看流式输出配置章节
- **THEN** 应引用 `BLOCK_STREAMING_CONFIG.md` 和 `STREAMING_GUIDE.md`
- **AND** 应说明如何启用和配置流式输出

#### Scenario: QChat 流式禁用特别说明

- **WHEN** 用户查看 QChat 配置说明
- **THEN** 应明确说明圈组消息禁用流式输出和文本分块
- **AND** 应说明原因（避免消息碎片化，提升用户体验）
