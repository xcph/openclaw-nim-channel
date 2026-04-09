# OpenClaw NIM 流式数据处理使用指南

## 🎯 功能概述

现在您的 OpenClaw NIM 插件已支持**实时流式数据捕获和转发**！当 OpenClaw 回复消息时，您可以：

1. **实时接收**每个消息块（block、tool、final）
2. **转发到您的服务器**进行进一步处理
3. **自定义回调处理**实现特定业务逻辑

## ⚠️ 圈组(QChat)特殊说明

**重要提示**: 圈组(QChat)消息不支持流式输出和文本分块。即使全局启用了流式配置或设置了 `textChunkLimit`，圈组消息也会强制禁用流式和分块，以**单条完整消息**的形式返回。

**影响范围**:

- ✅ **私聊(P2P)**: 支持流式输出和文本分块
- ✅ **群组(Team/SuperTeam)**: 支持流式输出和文本分块
- ❌ **圈组(QChat)**: 强制禁用流式和分块，单条完整返回

**原因**: 圈组频道内的流式分块会导致消息碎片化，影响用户体验。用户期望机器人回复作为一条完整消息展示。详见 [BLOCK_STREAMING_CONFIG.md](./BLOCK_STREAMING_CONFIG.md)。

## 🔧 配置方式

### 1. 环境变量配置

在您的 `.env` 文件中添加：

```bash
# 您的服务器接收流式数据的端点
NIM_STREAMING_SERVER_URL=https://your-server.com/api/nim-streaming

# 认证令牌（可选）
NIM_STREAMING_AUTH_TOKEN=your-secret-token
```

### 2. 程序化配置

您也可以在代码中动态配置：

```typescript
import { createNimReplyDispatcher, type StreamingOptions } from "@nimsuite/openclaw-nim-channel";

const streamingOptions: StreamingOptions = {
  enabled: true,
  serverUrl: "https://your-server.com/api/nim-streaming",
  authToken: "your-secret-token",
  onStreamChunk: (chunk, info) => {
    console.log(`收到流式数据:`, {
      kind: info.kind, // "block" | "tool" | "final"
      isComplete: info.isComplete, // 是否是最后一块
      text: chunk, // 文本内容
      length: chunk.length, // 文本长度
    });

    // 您的自定义处理逻辑
    if (info.kind === "final" && info.isComplete) {
      console.log("✅ 消息处理完成！");
    }
  },
};
```

## 📡 服务器端接收格式

您的服务器将接收到以下格式的 POST 请求：

```json
{
  "timestamp": "2026-03-16T08:44:59.123Z",
  "senderId": "user_12345",
  "kind": "block",
  "isComplete": false,
  "data": {
    "text": "这是 OpenClaw 回复的第一块文本...",
    "mediaList": [],
    "payload": {
      "text": "这是 OpenClaw 回复的第一块文本...",
      "mediaUrl": null,
      "mediaUrls": [],
      "channelData": {}
    }
  }
}
```

### 字段说明

- **timestamp**: 消息时间戳
- **senderId**: 发送者 ID（用户）
- **kind**: 消息类型
  - `"block"`: 文本块（流式生成的中间内容）
  - `"tool"`: 工具调用结果
  - `"final"`: 最终回复
- **isComplete**: 是否是完整消息的最后一部分
- **data**: 消息内容和元数据

## 🎨 使用场景

### 1. 实时进度展示

```typescript
onStreamChunk: (chunk, info) => {
  if (info.kind === "block") {
    // 实时显示 AI 生成进度
    updateProgressIndicator(chunk);
  }
};
```

### 2. 内容审核

```typescript
onStreamChunk: (chunk, info) => {
  // 实时内容审核
  if (containsSensitiveContent(chunk)) {
    logSecurityAlert(chunk, info);
  }
};
```

### 3. 分析统计

```typescript
onStreamChunk: (chunk, info) => {
  // 收集生成数据用于分析
  analytics.track("ai_response_chunk", {
    kind: info.kind,
    length: chunk.length,
    timestamp: new Date(),
  });
};
```

### 4. 多渠道同步

```typescript
onStreamChunk: (chunk, info) => {
  // 同步到其他平台
  if (info.isComplete) {
    syncToOtherPlatforms(chunk);
  }
};
```

## 🔒 安全建议

1. **使用 HTTPS**: 确保数据传输安全
2. **认证令牌**: 设置 `authToken` 验证请求来源
3. **速率限制**: 在服务器端实现适当的速率限制
4. **数据验证**: 验证接收到的数据格式和内容

## ⚡ 性能优化

1. **批量处理**: 考虑缓冲多个 chunk 后批量处理
2. **异步处理**: 使用异步方式避免阻塞消息发送
3. **错误恢复**: 实现重试和降级机制

## 🐛 故障排除

### 常见问题

1. **没有收到流式数据**
   - 检查 `streamingOptions.enabled` 是否为 `true`
   - 检查环境变量是否正确设置
   - 查看控制台日志中的 `[nim] streaming chunk` 消息

2. **服务器接收失败**
   - 检查服务器 URL 是否可达
   - 检查认证令牌是否正确
   - 查看网络日志中的错误信息

3. **数据格式问题**
   - 确认服务器端正确解析 JSON
   - 检查 Content-Type 是否为 `application/json`

### 调试模式

启用详细日志：

```typescript
const streamingOptions = {
  enabled: true,
  onStreamChunk: (chunk, info) => {
    console.log(`[DEBUG] ${info.kind}:`, chunk.substring(0, 100));
  },
};
```

## 🚀 现在您可以

1. **配置环境变量**设置服务器端点
2. **重启 OpenClaw**让配置生效
3. **发送消息**给您的 NIM 机器人
4. **观察日志**和服务器接收到的流式数据

流式数据功能已完全集成到您的 NIM 插件中！🎉
