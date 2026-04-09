# OpenClaw 流式配置指南

## 🎯 问题诊断

如果您看到这样的日志：

```
[nim] streaming chunk — kind: final, length: 3039, complete: true
```

说明 AI 模型没有启用流式输出，而是一次性生成了完整回复。

## 🔧 解决方案

### 1. OpenClaw 配置文件设置

在您的 OpenClaw 主配置文件中（通常是 `config.yaml` 或 `config.json`），需要确保 AI 模型启用了流式输出：

#### 对于 OpenAI 兼容模型

```yaml
agents:
  default:
    model:
      provider: "openai" # 或其他兼容提供商
      name: "gpt-4"
      options:
        stream: true # 🔥 关键：启用流式输出
        temperature: 0.7
        max_tokens: 4000
```

#### 对于其他模型提供商

```yaml
agents:
  default:
    model:
      provider: "anthropic" # 或 claude、gemini 等
      name: "claude-3-sonnet"
      options:
        stream: true # 🔥 关键：启用流式输出
        max_tokens: 4000
```

### 2. 环境变量配置

```bash
# 确保启用流式输出
OPENCLAW_STREAM_ENABLED=true

# 模型配置
OPENAI_STREAM=true
ANTHROPIC_STREAM=true
```

### 3. 验证配置

重启 OpenClaw 后，您应该看到这样的日志：

```
[nim] streaming chunk — kind: block, length: 156, complete: false
[nim] streaming chunk — kind: block, length: 287, complete: false
[nim] streaming chunk — kind: block, length: 195, complete: false
[nim] streaming chunk — kind: final, length: 89, complete: true
```

## 🔍 调试步骤

### 1. 检查模型配置

```bash
# 查找 OpenClaw 配置文件
find ~ -name "*.config.*" -o -name "config.*" 2>/dev/null | grep -i claw
```

### 2. 检查日志

```bash
# 查看 OpenClaw 启动日志
tail -f /path/to/openclaw/logs/app.log | grep -i stream
```

### 3. 测试流式输出

发送一个需要较长回答的问题，比如：
"请详细介绍一下人工智能的发展历史，包括关键节点和重要人物。"

## 🚨 常见问题

### Q: 仍然只看到一次性输出

**A**: 检查以下项目：

1. 模型配置中 `stream: true` 是否正确设置
2. API 密钥是否有权限使用流式输出
3. 网络连接是否稳定

### Q: 出现错误 "streaming not supported"

**A**: 某些模型或 API 版本可能不支持流式输出，尝试：

1. 更新到支持流式的模型版本
2. 检查 API 提供商的文档
3. 联系技术支持确认支持情况

### Q: 流式输出很慢

**A**: 可能的优化方案：

1. 调整 `temperature` 参数
2. 使用更快的模型
3. 检查网络延迟

## 📝 配置示例

### 完整的 OpenClaw 配置示例

```yaml
# config.yaml
server:
  port: 3000
  host: "localhost"

agents:
  default:
    name: "AI Assistant"
    model:
      provider: "openai"
      name: "gpt-4-turbo"
      options:
        stream: true # 启用流式输出
        temperature: 0.7
        max_tokens: 4000
        top_p: 0.9

channels:
  nim:
    enabled: true
    plugin: "./plugins/@nimsuite/openclaw-nim-channel"

logging:
  level: "info"
  streaming_debug: true # 启用流式调试日志
```

## 🎉 验证成功

当配置正确时，您将看到：

1. 多个 `kind: block` 的日志条目
2. 逐步增长的文本长度
3. 最后一个 `kind: final` 条目

这样您就可以实现真正的流式数据捕获和处理了！
