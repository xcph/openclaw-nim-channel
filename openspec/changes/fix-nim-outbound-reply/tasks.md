## 1. 分析与设计
- [x] 1.1 分析 Clawdbot SDK 的 outbound 接口规范（参考 WhatsApp/Telegram 插件）
- [x] 1.2 确认需要实现的方法：`sendText`, `sendMedia`, `resolveTarget`, `deliveryMode`, `chunker`, `textChunkLimit`

## 2. 重构 outbound 模块
- [x] 2.1 修改 `src/outbound.ts`，添加 `resolveNimOutboundTarget` 方法用于目标解析
- [x] 2.2 添加 `sendNimOutboundText` 异步方法，返回 `{ channel: "nim", ok, msgId?, error? }` 格式
- [x] 2.3 添加 `sendNimOutboundMedia` 异步方法，处理媒体文件发送
- [x] 2.4 创建 `nimOutboundConfig` 对象，包含完整的 outbound 配置

## 3. 修改 channel 配置
- [x] 3.1 更新 `src/channel.ts` 中的 `outbound` 属性，使用新的对象结构
- [x] 3.2 添加 `deliveryMode: "gateway"` 配置
- [x] 3.3 配置 `textChunkLimit: 5000`
- [x] 3.4 集成 `splitMessageIntoChunks` 作为 chunker
- [x] 3.5 修复 `reply-dispatcher.ts`，使用 SDK 的 `createReplyDispatcherWithTyping` 创建正确格式的 dispatcher（支持 `sendBlockReply`/`sendToolResult`/`sendFinalReply` 方法）

## 4. 验证与测试
- [x] 4.1 本地测试：通过 NIM 客户端发送消息给 MoltBot
- [x] 4.2 验证 MoltBot 处理后能够回复消息到 NIM 客户端
- [ ] 4.3 测试长消息自动分割功能
- [ ] 4.4 测试媒体消息发送功能

## 5. 文档与清理
- [x] 5.1 更新 index.ts 导出新的函数
- [x] 5.2 添加调试日志，便于排查问题