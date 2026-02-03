/**
 * NIM Client - node-nim SDK V2 API 封装
 * 
 * 使用网易云信官方 Node.js SDK (node-nim) V2 版本
 */

import type { 
  NimConfig, 
  NimClientInstance, 
  NimMessageEvent, 
  NimSendResult,
  NimSessionType,
  NimMessageType,
  NimAttachment,
} from "./types.js";
import { resolveNimCredentials } from "./accounts.js";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

// 客户端缓存
const clientCache = new Map<string, NimClientInstance>();

// 消息回调管理
const messageCallbacks = new Map<string, Set<(msg: NimMessageEvent) => void>>();
const connectionCallbacks = new Map<string, Set<(state: string) => void>>();

/**
 * 获取 SDK 数据目录
 */
function getSdkDataPath(account: string): string {
  const dataDir = path.join(os.homedir(), ".openclaw-nim", account);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

/**
 * 将 V2 消息类型转换为我们的类型
 */
function convertMessageType(v2Type: number): NimMessageType {
  // V2NIMMessageType 枚举
  const typeMap: Record<number, NimMessageType> = {
    0: "text",
    1: "image",
    2: "audio",
    3: "video",
    4: "geo",
    5: "notification",
    6: "file",
    10: "tip",
    11: "robot",
    100: "custom",
  };
  return typeMap[v2Type] || "unknown";
}

/**
 * 从 conversationId 解析会话类型
 * conversationId 格式: {appId}|{type}|{targetId}
 */
function parseConversationId(conversationId: string): { sessionType: NimSessionType; targetId: string } {
  const parts = conversationId.split("|");
  if (parts.length >= 3) {
    const typeNum = parseInt(parts[1], 10);
    const sessionType: NimSessionType = typeNum === 1 ? "p2p" : typeNum === 2 ? "team" : typeNum === 3 ? "superTeam" : "p2p";
    return { sessionType, targetId: parts[2] };
  }
  return { sessionType: "p2p", targetId: "" };
}

/**
 * 构建 conversationId
 */
function buildConversationId(conversationIdUtil: any, accountId: string, sessionType: NimSessionType): string {
  if (conversationIdUtil) {
    switch (sessionType) {
      case "p2p":
        return conversationIdUtil.p2pConversationId(accountId) || "";
      case "team":
        return conversationIdUtil.teamConversationId(accountId) || "";
      case "superTeam":
        return conversationIdUtil.superTeamConversationId(accountId) || "";
      default:
        return conversationIdUtil.p2pConversationId(accountId) || "";
    }
  }
  // fallback: 手动构建
  const typeNum = sessionType === "p2p" ? 1 : sessionType === "team" ? 2 : 3;
  return `0|${typeNum}|${accountId}`;
}

/**
 * 解析 V2 消息附件
 */
function parseV2Attachment(msg: any): NimAttachment | undefined {
  const attachment = msg.attachment;
  if (!attachment) return undefined;

  return {
    name: attachment.name,
    size: attachment.size,
    url: attachment.url,
    ext: attachment.ext,
    md5: attachment.md5,
    w: attachment.width,
    h: attachment.height,
    dur: attachment.duration,
  };
}

/**
 * 将 V2 消息转换为我们的消息事件格式
 */
function convertV2ToMessageEvent(msg: any): NimMessageEvent {
  const { sessionType } = parseConversationId(msg.conversationId || "");
  
  return {
    msgId: String(msg.messageServerId || msg.messageClientId || ""),
    clientMsgId: String(msg.messageClientId || ""),
    sessionType,
    from: String(msg.senderId || ""),
    to: String(msg.receiverId || ""),
    type: convertMessageType(msg.messageType),
    text: msg.text || "",
    time: msg.createTime || Date.now(),
    attach: parseV2Attachment(msg),
    ext: msg.serverExtension ? JSON.parse(msg.serverExtension) : undefined,
    rawMsg: msg,
  };
}

/**
 * 创建 NIM 客户端实例 (V2 API)
 */
export async function createNimClient(cfg: NimConfig): Promise<NimClientInstance> {
  const creds = resolveNimCredentials(cfg);
  if (!creds) {
    throw new Error("NIM credentials not configured");
  }
  
  const cacheKey = `${creds.appKey}:${creds.account}`;

  // 检查缓存
  const cached = clientCache.get(cacheKey);
  if (cached && cached.initialized) {
    return cached;
  }

  // 动态导入 node-nim
  const nodenim = await import("node-nim");
  
  // 使用 V2 API
  const v2Client = new nodenim.V2NIMClient();
  
  const dataPath = getSdkDataPath(creds.account);

  // 初始化 SDK (V2)
  const initError = v2Client.init({
    appkey: creds.appKey,
    appDataPath: dataPath,
  });

  if (initError) {
    throw new Error(`NIM SDK V2 initialization failed: ${initError.desc}`);
  }

  console.log("[NIM V2] SDK initialized, dataPath:", dataPath);

  let loggedIn = false;
  const msgCallbackSet = new Set<(msg: NimMessageEvent) => void>();
  const connCallbackSet = new Set<(state: string) => void>();

  messageCallbacks.set(cacheKey, msgCallbackSet);
  connectionCallbacks.set(cacheKey, connCallbackSet);

  // 获取服务
  const loginService = v2Client.getLoginService();
  const messageService = v2Client.getMessageService();
  const messageCreator = v2Client.messageCreator;
  const conversationIdUtil = v2Client.conversationIdUtil;

  if (!loginService || !messageService) {
    throw new Error("NIM SDK V2 services not available");
  }

  // 注册消息接收回调
  messageService.on("receiveMessages", (messages: any[]) => {
    console.log("[NIM V2] Received messages:", messages.length);
    for (const msg of messages) {
      console.log("[NIM V2] Message:", JSON.stringify(msg, null, 2));
      const event = convertV2ToMessageEvent(msg);
      msgCallbackSet.forEach((cb) => cb(event));
    }
  });

  // 注册发送消息状态回调
  messageService.on("sendMessage", (msg: any) => {
    console.log("[NIM V2] Send message status:", msg.messageClientId, msg.sendingState);
  });

  // 注册登录状态回调
  loginService.on("loginStatus", (status: number) => {
    console.log("[NIM V2] Login status changed:", status);
    // V2NIMLoginStatus: 0=LOGOUT, 1=LOGINED, 2=LOGINING
    if (status === 1) {
      loggedIn = true;
      connCallbackSet.forEach((cb) => cb("connected"));
    } else if (status === 0) {
      loggedIn = false;
      connCallbackSet.forEach((cb) => cb("logout"));
    }
  });

  loginService.on("kickedOffline", (detail: any) => {
    console.log("[NIM V2] Kicked offline:", detail);
    loggedIn = false;
    connCallbackSet.forEach((cb) => cb("kickout"));
  });

  loginService.on("disconnected", (error: any) => {
    console.log("[NIM V2] Disconnected:", error);
    connCallbackSet.forEach((cb) => cb("disconnected"));
  });

  const instance: NimClientInstance = {
    initialized: true,
    loggedIn: false,
    account: creds.account,

    async login(): Promise<boolean> {
      try {
        console.log("[NIM V2] Logging in...", creds.account);
        await loginService.login(creds.account, creds.token, {});
        loggedIn = true;
        instance.loggedIn = true;
        console.log("[NIM V2] Login successful");
        return true;
      } catch (error: any) {
        console.error("[NIM V2] Login failed:", error);
        return false;
      }
    },

    async logout(): Promise<void> {
      try {
        await loginService.logout();
        loggedIn = false;
        instance.loggedIn = false;
        console.log("[NIM V2] Logged out");
      } catch (error) {
        console.error("[NIM V2] Logout error:", error);
      }
    },

    async sendText(to: string, text: string, sessionType: NimSessionType = "p2p"): Promise<NimSendResult> {
      try {
        const message = messageCreator?.createTextMessage(text);
        if (!message) {
          return { success: false, error: "Failed to create text message" };
        }

        const conversationId = buildConversationId(conversationIdUtil, to, sessionType);
        console.log("[NIM V2] Sending text to:", conversationId, "text:", text.substring(0, 50));

        const result = await messageService.sendMessage(message, conversationId, {}, () => {});
        
        console.log("[NIM V2] Send result:", result);
        return {
          success: true,
          msgId: result.message?.messageServerId,
          clientMsgId: result.message?.messageClientId,
        };
      } catch (error: any) {
        console.error("[NIM V2] Send text failed:", error);
        return {
          success: false,
          error: error.message || String(error),
        };
      }
    },

    async sendImage(to: string, filePath: string, sessionType: NimSessionType = "p2p"): Promise<NimSendResult> {
      try {
        const message = messageCreator?.createImageMessage(filePath, path.basename(filePath), "", 0, 0);
        if (!message) {
          return { success: false, error: "Failed to create image message" };
        }

        const conversationId = buildConversationId(conversationIdUtil, to, sessionType);
        console.log("[NIM V2] Sending image to:", conversationId);

        const result = await messageService.sendMessage(message, conversationId, {}, () => {});
        
        return {
          success: true,
          msgId: result.message?.messageServerId,
          clientMsgId: result.message?.messageClientId,
        };
      } catch (error: any) {
        console.error("[NIM V2] Send image failed:", error);
        return { success: false, error: error.message || String(error) };
      }
    },

    async sendFile(to: string, filePath: string, sessionType: NimSessionType = "p2p"): Promise<NimSendResult> {
      try {
        const message = messageCreator?.createFileMessage(filePath, path.basename(filePath), "");
        if (!message) {
          return { success: false, error: "Failed to create file message" };
        }

        const conversationId = buildConversationId(conversationIdUtil, to, sessionType);
        console.log("[NIM V2] Sending file to:", conversationId);

        const result = await messageService.sendMessage(message, conversationId, {}, () => {});
        
        return {
          success: true,
          msgId: result.message?.messageServerId,
          clientMsgId: result.message?.messageClientId,
        };
      } catch (error: any) {
        console.error("[NIM V2] Send file failed:", error);
        return { success: false, error: error.message || String(error) };
      }
    },

    async sendAudio(to: string, filePath: string, duration: number, sessionType: NimSessionType = "p2p"): Promise<NimSendResult> {
      try {
        const message = messageCreator?.createAudioMessage?.(filePath, path.basename(filePath), "", duration);
        if (!message) {
          return { success: false, error: "Failed to create audio message" };
        }

        const conversationId = buildConversationId(conversationIdUtil, to, sessionType);
        const result = await messageService.sendMessage(message, conversationId, {}, () => {});
        
        return {
          success: true,
          msgId: result.message?.messageServerId,
          clientMsgId: result.message?.messageClientId,
        };
      } catch (error: any) {
        console.error("[NIM V2] Send audio failed:", error);
        return { success: false, error: error.message || String(error) };
      }
    },

    async sendVideo(to: string, filePath: string, duration: number, width: number, height: number, sessionType: NimSessionType = "p2p"): Promise<NimSendResult> {
      try {
        const message = messageCreator?.createVideoMessage?.(filePath, path.basename(filePath), "", duration, width, height);
        if (!message) {
          return { success: false, error: "Failed to create video message" };
        }

        const conversationId = buildConversationId(conversationIdUtil, to, sessionType);
        const result = await messageService.sendMessage(message, conversationId, {}, () => {});
        
        return {
          success: true,
          msgId: result.message?.messageServerId,
          clientMsgId: result.message?.messageClientId,
        };
      } catch (error: any) {
        console.error("[NIM V2] Send video failed:", error);
        return { success: false, error: error.message || String(error) };
      }
    },

    onMessage(callback: (msg: NimMessageEvent) => void): void {
      msgCallbackSet.add(callback);
    },

    offMessage(callback: (msg: NimMessageEvent) => void): void {
      msgCallbackSet.delete(callback);
    },

    onConnectionChange(callback: (state: string) => void): void {
      connCallbackSet.add(callback);
    },

    async destroy(): Promise<void> {
      await instance.logout();
      v2Client.uninit();
      clientCache.delete(cacheKey);
      messageCallbacks.delete(cacheKey);
      connectionCallbacks.delete(cacheKey);
    },
  };

  clientCache.set(cacheKey, instance);
  return instance;
}

/**
 * 获取缓存的客户端
 */
export function getCachedNimClient(cfg: NimConfig): NimClientInstance | undefined {
  const creds = resolveNimCredentials(cfg);
  if (!creds) return undefined;
  const cacheKey = `${creds.appKey}:${creds.account}`;
  return clientCache.get(cacheKey);
}

/**
 * 清除客户端缓存
 */
export async function clearNimClientCache(cfg?: NimConfig): Promise<void> {
  if (cfg) {
    const creds = resolveNimCredentials(cfg);
    if (!creds) return;
    const cacheKey = `${creds.appKey}:${creds.account}`;
    const client = clientCache.get(cacheKey);
    if (client) {
      await client.destroy();
    }
  } else {
    for (const client of clientCache.values()) {
      await client.destroy();
    }
    clientCache.clear();
  }
}