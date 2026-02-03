# Project Context

## Purpose
OpenClaw NIM Plugin 是一个基于网易云信 IM SDK 的 OpenClaw 渠道插件，用于通过网易云信 IM 与 AI 机器人进行交互。

## Tech Stack
- **Runtime**: Node.js >= 20.19.0
- **Package Manager**: npm
- **Language**: TypeScript (推荐) / JavaScript
- **Testing**: Jest / Vitest
- **Linting**: ESLint + Prettier

## Project Conventions

### Code Style
- 使用 TypeScript 进行类型安全的开发
- 遵循 ESLint 规则，使用 Prettier 进行代码格式化
- 命名规范：
  - 文件名：kebab-case（如 `login-analyzer.ts`）
  - 类名：PascalCase（如 `LoginAnalyzer`）
  - 函数/变量：camelCase（如 `analyzeLoginData`）
  - 常量：UPPER_SNAKE_CASE（如 `MAX_RETRY_COUNT`）

### Architecture Patterns
- 模块化设计，每个功能模块独立
- 使用依赖注入便于测试
- 配置与代码分离

### Testing Strategy
- 单元测试覆盖核心业务逻辑
- 集成测试验证模块间交互
- 测试文件与源文件同目录，命名为 `*.test.ts`

### Git Workflow
- 主分支：`main`
- 功能分支：`feature/<feature-name>`
- 修复分支：`fix/<issue-description>`
- Commit 格式：`<type>(<scope>): <description>`
  - type: feat, fix, docs, style, refactor, test, chore

## Domain Context
- **网易云信 IM SDK**: 提供即时通讯能力的 SDK，支持消息、音视频、信令等功能
- **登录流程**: 包含 LBS 解析、TCP 连接建立、协议握手等阶段
- **成功率指标**: 关注登录成功率、首次连接时间、重连成功率等核心指标

## Important Constraints
- 数据安全：不在日志中暴露用户敏感信息
- 性能要求：分析任务不应阻塞主业务流程
- 兼容性：需考虑不同版本 SDK 的日志格式差异

## External Dependencies
- 网易云信 IM SDK 客户端日志上报数据
- 内部监控和日志分析平台（如有）