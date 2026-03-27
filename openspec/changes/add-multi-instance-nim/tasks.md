## 1. 配置 Schema 改造

- [x] 1.1 新建 `NimInstanceConfigSchema`（单实例配置 schema），包含凭证字段 (`nimToken` 或 `appKey`/`account`/`token`)、`p2p`、`team`、`qchat`、`advanced`、`enabled`，无 `id` 字段
- [x] 1.2 将 `NimConfigSchema` 改为 `z.array(NimInstanceConfigSchema)`，并添加实例数上限验证（最多 3 个）
- [x] 1.3 更新 `types.ts` 中的 `NimConfig` / `NimInstanceConfig` 类型定义
- [x] 1.4 更新 `configSchema`（JSON Schema）为数组格式，更新 `uiHints`

## 2. 账号解析层改造

- [x] 2.1 改写 `accounts.ts` 中的 `resolveNimAccount` → `resolveAllNimAccounts`，返回 `ResolvedNimAccount[]`
- [x] 2.2 改写 `listAccountIds` → 枚举所有实例的派生 `appKey:accid` 标识
- [x] 2.3 新增 `resolveNimAccountByKey(accountId: string)` 工具函数，按 `appKey:accid` 匹配实例
- [x] 2.4 更新 `resolveNimCredentials` 支持单实例入参（`NimInstanceConfig`）

## 3. Channel 插件改造

- [x] 3.1 更新 `reload.configPrefixes` → `["channels.nim"]`（无变化，数组整体监听）
- [x] 3.2 改写 `config.listAccountIds` → 从数组中提取所有实例的派生 `appKey:accid` 标识
- [x] 3.3 改写 `config.resolveAccount` → 按 `accountId` 匹配对应实例
- [x] 3.4 改写 `config.setAccountEnabled` / `config.deleteAccount` 支持多实例
- [x] 3.5 改写 `security.resolveDmPolicy` 按实例 accountId 查找对应配置
- [x] 3.6 改写 `security.collectWarnings` 遍历所有实例
- [x] 3.7 改写 `status.defaultRuntime` → 移除单账号默认值
- [x] 3.8 改写 `gateway.startAccount` → 按 `accountId` 启动对应实例
- [x] 3.9 更新 `setup.resolveAccountId` / `setup.applyAccountConfig` 适配多实例

## 4. Monitor 层改造

- [x] 4.1 `monitorNimProvider` 接收单实例配置 + `accountId`，支持并发启动多个 monitor
- [x] 4.2 确保 `monitorStates` Map 键仍使用 `appKey:account` 唯一标识，防止重复启动

## 5. QChat 层改造

- [x] 5.1 将 `qchat-send.ts` 中的 `sharedQChatClient` 单例改为 `Map<accountId, QChatClient>`
- [x] 5.2 确保 QChat 发送函数按 `accountId` 选取正确实例

## 6. 出站路由改造

- [x] 6.1 `outbound.ts` / `send.ts` 按 `accountId` 选取对应 NIM 客户端实例发送消息
- [x] 6.2 `bot.ts` `handleNimMessage` 接收 `accountId` 参数，传递给下游发送调用

## 7. 测试与验证

- [x] 7.1 单元测试：`NimConfigSchema` 数组验证（≤3 个实例、缺失凭证、重复 id）
- [x] 7.2 单元测试：`resolveAllNimAccounts` 多实例解析
- [x] 7.3 集成测试：两个实例同时启动，消息各自路由到对应实例
- [x] 7.4 回归测试：单实例场景（数组长度为 1）行为不变
