# OpenClaw NIM 插件

[OpenClaw](https://openclaw.ai/) 网易云信（NIM）渠道插件，支持 P2P 单聊、群组聊天及圈组（QChat）。

## 功能特性

- 💬 P2P 单聊消息，支持可配置的访问策略
- 👥 群组聊天，支持群/发送者白名单
- 🔵 圈组（QChat）消息，支持统一白名单
- 🌊 流式输出支持（私聊和群组支持分块流式，圈组强制完整消息返回）
- 🔄 多实例支持（支持同时运行最多 3 个 NIM 实例，不同账号/AppKey）
- 📷 多媒体支持（图片、文件、音频、视频）
- 🔐 简化的 `nimToken` 认证
- 🔄 自动重连处理
- 📝 长消息自动分片
- 🔒 私有化部署支持

## 安装

```bash
openclaw plugins install openclaw-nim
```

## 快速配置

```bash
openclaw config set channels.nim.instances.0.nimToken "<appKey>|<accid>|<token>"
openclaw config set channels.nim.instances.0.enabled true
```

## 支持的消息类型

| 类型   | 接收 | 发送 |
| ------ | ---- | ---- |
| 文本   | ✅   | ✅   |
| 图片   | ✅   | ✅   |
| 文件   | ✅   | ✅   |
| 音频   | ✅   | ✅   |
| 视频   | ✅   | ✅   |
| 位置   | ✅   | ❌   |
| 自定义 | ✅   | ❌   |

## 获取凭证

1. 登录 [网易云信控制台](https://app.netease.im/)
2. 创建或选择应用
3. 复制 **AppKey**
4. 创建**机器人账号**并获取 **Account ID** 和 **Token**

> **注意**：仅支持机器人账号，不支持普通个人账号。

## 许可证

MIT
