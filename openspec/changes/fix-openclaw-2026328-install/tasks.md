## 1. Fix package.json for reliable installation

- [x] 1.1 移除 `peerDependencies` 中的 `openclaw` 声明
- [x] 1.2 添加 `bundledDependencies: ["@yxim/nim-bot", "zod"]`，将运行时依赖打包进 tgz
- [x] 1.3 确认 `files` 字段包含所有必要文件（当前已包含 `index.ts`, `src`, `openclaw.plugin.json`, `CHANGELOG.md`）

## 2. Verify packaging

- [x] 2.1 运行 `npm pack` 生成 tgz，检查包内容是否包含 bundled dependencies
- [x] 2.2 在隔离目录中解压 tgz，运行 `npm install --omit=dev --silent --ignore-scripts` 验证无报错

## 3. Verify installation on OpenClaw

- [ ] 3.1 在 OpenClaw 2026.3.28 环境中通过 `openclaw plugins install <tgz路径>` 安装验证
- [ ] 3.2 确认插件加载正常，NIM 通道功能可用

## 4. Release

- [x] 4.1 更新版本号（1.0.1 → 1.0.2）
- [x] 4.2 更新 CHANGELOG.md
- [ ] 4.3 发布到 ClawHub
