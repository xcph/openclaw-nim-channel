## 1. Implementation

- [x] 1.1 在 `src/config-schema.ts` 的 `NimConfigSchema` 中新增可选字段 `nimToken: z.string().optional()`
- [x] 1.2 在 `src/accounts.ts` 的 `resolveNimCredentials` 中添加 `nimToken` 解析逻辑：优先按 `-` 分隔解析为三段（appKey、account、token），若失败则回退到原有字段
- [x] 1.3 在 `resolveNimCredentials` 中添加日志，当 `nimToken` 解析成功时打印使用 nimToken 的提示

## 2. Validation

- [ ] 2.1 手动测试：仅配置 `nimToken` 字段，确认能正确登录
- [ ] 2.2 手动测试：同时配置 `nimToken` 和独立字段，确认 `nimToken` 优先
- [ ] 2.3 手动测试：仅配置独立字段（无 nimToken），确认向后兼容
- [ ] 2.4 手动测试：`nimToken` 格式不正确（少于 3 段），确认回退到独立字段
