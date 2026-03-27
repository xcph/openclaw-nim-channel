# OpenClaw 分块流式配置解决方案

## 🎯 问题根源

根据 OpenClaw 官方文档，您看到的一次性输出是因为：

- `blockStreamingDefault: "off"` (默认关闭分块流式)
- `blockStreamingBreak: "message_end"` (等完整消息生成后才发送)

## 🔧 解决配置

### 1. 启用分块流式输出

在您的 OpenClaw 配置文件中添加：

```yaml
# config.yaml
agents:
  defaults:
    # 🔥 启用分块流式 (核心配置)
    blockStreamingDefault: "on"

    # 🔥 设置流式断点 (实时发送)
    blockStreamingBreak: "text_end" # 而不是 "message_end"

    # 分块配置
    blockStreamingChunk:
      minChars: 100 # 最小字符数才发送
      maxChars: 800 # 最大字符数强制发送
      breakPreference: "paragraph" # 优先在段落边界断开

    # 合并配置 (可选 - 减少碎片化)
    blockStreamingCoalesce:
      minChars: 200 # 累积到200字符再发送
      maxChars: 1000 # 超过1000字符强制发送
      idleMs: 500 # 500ms空闲后发送

channels:
  nim:
    # 🔥 NIM 渠道启用分块流式
    blockStreaming: true

    # 文本分块限制
    textChunkLimit: 4000
    chunkMode: "length" # 或 "newline" 按段落分割
```

### 2. 千问模型配置

```yaml
agents:
  defaults:
    # 分块流式配置
    blockStreamingDefault: "on"
    blockStreamingBreak: "text_end"

    model:
      provider: "dashscope"
      name: "qwen-turbo"
      options:
        stream: true # 模型层流式
        incremental_output: true # 千问增量输出
        temperature: 0.7
```

## 🎛️ 配置参数详解

### blockStreamingBreak 选项

- **`"text_end"`** ✅ 推荐：AI 生成时实时发送块
- **`"message_end"`** ❌ 问题：等完整消息生成后才发送

### blockStreamingChunk 参数

- **`minChars`**: 最少累积多少字符才发送一块
- **`maxChars`**: 超过多少字符强制发送
- **`breakPreference`**: 断开优先级 (`paragraph` > `newline` > `sentence` > `whitespace`)

### blockStreamingCoalesce 参数 (可选)

- **`idleMs`**: 空闲多久后发送缓冲区
- **`minChars`**: 合并的最小字符数
- **`maxChars`**: 合并的最大字符数

## 🚀 完整配置示例

```yaml
# OpenClaw config.yaml
server:
  port: 3000

agents:
  defaults:
    # 🔥 核心分块流式配置
    blockStreamingDefault: "on"
    blockStreamingBreak: "text_end"

    # 分块策略
    blockStreamingChunk:
      minChars: 150
      maxChars: 600
      breakPreference: "paragraph"

    # 合并策略 (减少碎片)
    blockStreamingCoalesce:
      minChars: 300
      maxChars: 800
      idleMs: 800

    # 千问模型
    model:
      provider: "dashscope"
      name: "qwen-turbo"
      options:
        stream: true
        incremental_output: true
        temperature: 0.7
        max_tokens: 2000

channels:
  nim:
    enabled: true
    blockStreaming: true # 🔥 NIM 渠道启用分块
    textChunkLimit: 4000
    plugin: "./plugins/openclaw-nim"

logging:
  level: "info"
```

## 🔍 验证效果

正确配置后，您应该看到：

```bash
# 之前 (错误)
[nim] streaming chunk — kind: final, length: 3039, complete: true

# 之后 (正确)
[nim] streaming chunk — kind: block, length: 156, complete: false
[nim] streaming chunk — kind: block, length: 287, complete: false
[nim] streaming chunk — kind: block, length: 195, complete: false
[nim] streaming chunk — kind: final, length: 89, complete: true
```

## 🎯 关键要点

1. **`blockStreamingDefault: "on"`** - 启用分块流式
2. **`blockStreamingBreak: "text_end"`** - 实时发送而不是等待结束
3. **`channels.nim.blockStreaming: true`** - NIM 渠道启用分块
4. **模型 `stream: true`** - 千问模型启用流式输出

这样配置后，您就能获得真正的流式分块输出了！
