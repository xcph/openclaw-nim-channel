## 1. Implementation

- [x] 1.1 将 `src/client.ts` 中 `loginService.login()` 调用的 `aiBot` 参数从 `1` 改为 `2`
- [x] 1.2 验证所有通过 `client.login()` 登录的路径均走同一入口（已确认：`monitor.ts`、`probe.ts`、`media.ts`、`send.ts` 均调用 `client.login()`）

## 2. Validation

- [ ] 2.1 手动测试登录，确认 bot 以 AI Bot 身份成功登录
- [ ] 2.2 确认服务端日志显示正确的 AI Bot 身份标识
