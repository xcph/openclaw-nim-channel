## 1. 代码实现

- [x] 1.1 修改 `src/qchat-inbound.ts` 中的 `handleQChatInbound` 函数
  - [x] 在调用 `dispatchReplyWithBufferedBlockDispatcher` 时,添加 `disableStreaming: true` 选项
  - [x] 确保此设置不影响私聊和群组的流式行为

- [x] 1.2 验证 OpenClaw SDK 的 `dispatchReplyWithBufferedBlockDispatcher` API
  - [x] 确认该函数支持 `disableStreaming` 或类似参数
  - [x] 使用 `disableStreaming: true` 参数实现

- [x] 1.3 添加日志记录
  - [x] 在禁用圈组流式时记录日志,便于调试和监控
  - [x] 日志格式: `[qchat] streaming disabled for QChat — using complete message delivery`

## 2. 测试验证

- [ ] 2.1 手动测试
  - [ ] 重启 OpenClaw 服务
  - [ ] 向圈组频道发送消息并@机器人,验证回复是一次性完整返回
  - [ ] 观察日志,确认看到缓冲机制工作(buffering chunk, sending buffered complete message)
  - [ ] 向私聊和群组发送消息,验证不受影响

- [ ] 2.2 边界情况测试
  - [ ] 测试长文本回复(>1000字符)在圈组中的表现
  - [ ] 测试包含媒体附件的回复
  - [ ] 测试圈组消息的回复被 policy 阻止的情况

## 3. 文档更新

- [x] 3.1 更新 `BLOCK_STREAMING_CONFIG.md`
  - [x] 添加说明:圈组消息始终禁用流式,不受全局配置影响
  - [x] 明确私聊和群组支持流式配置

- [x] 3.2 更新 `STREAMING_GUIDE.md`
  - [x] 补充圈组流式行为的特殊说明

- [x] 3.3 更新 `README.zh-CN.md`
  - [x] 在功能特性章节说明圈组消息的输出特点

## 4. 代码审查与合并

- [ ] 4.1 自测通过所有场景
- [ ] 4.2 提交 Pull Request
- [ ] 4.3 代码审查通过
- [ ] 4.4 合并到主分支
