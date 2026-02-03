# Tasks: 重命名项目为 OpenClaw NIM Plugin

## 1. 核心配置文件修改

- [x] 1.1 修改 `package.json`：
  - `name`: `moltbot-nim` → `openclaw-nim`
  - `description`: `MoltBot NIM` → `OpenClaw NIM`
  - `keywords`: 保留 `clawdbot`，添加 `openclaw`，移除 `moltbot`
  
- [x] 1.2 修改 `clawdbot.plugin.json`：
  - `id`: `moltbot-nim` → `openclaw-nim`

- [x] 1.3 修改 `index.ts`：
  - `plugin.id`: `moltbot-nim` → `openclaw-nim`
  - 注释描述更新

- [x] 1.4 修改 `package-lock.json`：
  - 删除并重新生成（通过 `rm package-lock.json && npm install`）

## 2. 源代码修改

- [x] 2.1 修改 `src/client.ts`：
  - 数据目录: `~/.moltbot-nim/` → `~/.openclaw-nim/`

## 3. 文档修改

- [x] 3.1 修改 `README.md`：
  - 标题、描述中的 `MoltBot` → `OpenClaw`
  - 安装命令中的 `moltbot-nim` → `openclaw-nim`
  - 示例代码中的导入路径

- [x] 3.2 修改 `docs/tech-sharing-clawdbot-plugin-development.md`：
  - 项目名称和描述更新
  - 保持 Clawdbot SDK 相关术语不变

## 4. OpenSpec 文档修改

- [x] 4.1 修改 `openspec/project.md`：
  - 项目描述中的 `MoltBot-NIM` → `OpenClaw NIM Plugin`

- [x] 4.2 更新 `.gitignore`：
  - `moltbot-feishu` → 保留（历史记录）

## 5. 验证

- [x] 5.1 运行 `npm install` 确保依赖正常
- [x] 5.2 运行 `npm run typecheck` 确保类型检查通过
- [x] 5.3 运行 `openspec validate rename-to-openclaw --strict` 确保规范验证通过
- [ ] 5.4 本地测试插件加载和基本功能

## 6. 发布

- [ ] 6.1 在 npm 上 deprecate 旧包 `moltbot-nim`
- [ ] 6.2 发布新包 `openclaw-nim`

---

## Notes

- `clawdbot` 依赖包名保持不变，因为底层 SDK 尚未改名
- 历史 change 文档（如 `add-nim-channel-plugin`）中的描述暂不修改，保留历史记录
