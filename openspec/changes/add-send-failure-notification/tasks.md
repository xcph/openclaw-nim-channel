## 1. Implementation

- [x] 1.1 在 `src/send.ts` 中新增错误码描述映射表 `NIM_ERROR_CODES`
- [x] 1.2 新增辅助函数 `getNimErrorDescription(errorCode, errorMessage)` 获取错误描述
- [x] 1.3 新增辅助函数 `formatSendFailureMessage(errorCode, errorMessage)` 格式化失败消息
- [x] 1.4 修改 `src/client.ts` 中所有消息发送方法，确保返回 `errorCode` 字段
- [x] 1.5 修改 `src/outbound.ts` 中的 `sendNimOutboundText` 函数，在发送失败时自动发送通知
- [x] 1.6 通知消息直接调用 client.sendText，绕过 outbound 层防止递归
- [x] 1.7 修复 P1 级别阻断问题（递归保护 + 统一错误返回格式）
- [ ] 1.8 添加单元测试验证错误码描述映射（可选）

## 2. Code Review Fixes

- [x] 2.1 修复递归保护失效问题：通知消息改为直接调用 client.sendText
- [x] 2.2 修复 sendImage/sendFile/sendAudio/sendVideo 方法未返回 errorCode
- [x] 2.3 统一所有 catch 块的错误返回格式
