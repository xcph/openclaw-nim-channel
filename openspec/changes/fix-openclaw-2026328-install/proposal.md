# Change: Fix OpenClaw 2026.3.28 plugin installation failure

## Why

在 OpenClaw 2026.3.28 (f9b1079) 上通过 `openclaw plugins install clawhub:openclaw-nim` 安装插件时，
npm install 阶段静默失败（Windows 环境），导致整个 plugin 安装失败。OpenClaw 随后 fallback 尝试
作为 hook pack 安装，但因 `package.json` 缺少 `openclaw.hooks` 字段也一并失败。

错误信息：

```
npm install failed:
Also not a valid hook pack: Error: package.json missing openclaw.hooks
```

## Root Cause Analysis

通过分析 OpenClaw 源码（`src/infra/install-package-dir.ts`），安装流程如下：

1. 从 ClawHub 下载 `openclaw-nim-1.0.1.tgz`
2. 解压到临时目录，复制到 stage 目录
3. 在 stage 目录执行 `npm install --omit=dev --silent --ignore-scripts`
4. **npm install 失败**（stderr/stdout 为空，可能原因见下方）
5. 由于 plugin 安装失败，OpenClaw 的 `plugins-install-command.ts` fallback 到 hook pack 安装
6. hook pack 安装调用 `ensureOpenClawHooks()` 时发现 `package.json` 中无 `openclaw.hooks` 字段

npm install 静默失败的可能原因（需进一步确认）：

- **peerDependencies 解析失败**: `openclaw` 的 peerDependency 在隔离安装环境中无法满足，
  npm 7+ 默认尝试安装 peerDependencies，在某些 npm 版本/配置下可能导致非零退出码
- **Windows npm 环境问题**: `.npmrc` 配置、网络代理、npm 缓存等

## What Changes

- 移除 `peerDependencies` 中的 `openclaw`，避免隔离安装时的 peer dependency 解析问题
- 将 `@yxim/nim-bot` 和 `zod` 添加到 `bundledDependencies`，确保依赖随 npm pack 一同打包，
  消除安装时对外部 npm registry 的依赖
- 更新 `package.json` 的 `files` 字段，确保打包产物完整

## Impact

- Affected specs: `nim-channel` (Plugin Registration requirement)
- Affected code: `package.json`
- 不影响运行时行为，仅影响打包和安装流程
