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
  NimP2pPolicy,
} from "./types.js";
import { resolveNimCredentials, isNimP2pAllowed } from "./accounts.js";
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
  
  // Extract forcePushAccountIds from V2 push config
  const forcePushAccountIds: string[] | undefined =
    msg.pushConfig?.forcePushAccountIds ?? undefined;

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
    forcePushAccountIds,
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
  
  // 初始化 SDK (V2)
  const initError = v2Client.init({
    appkey: creds.appKey
  });

  if (initError) {
    throw new Error(`NIM SDK V2 initialization failed: ${initError.desc}`);
  }

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

  // 获取好友服务
  const friendService = v2Client.friendService;

  // 注册好友申请监听 — 根据 p2pPolicy 自动接受好友申请
  if (friendService) {
    const p2pPolicy = (cfg.p2pPolicy as NimP2pPolicy) ?? "open";
    const allowFrom = cfg.allowFrom ?? [];

    friendService.on("friendAddApplication", async (application: any) => {
      const applicantId = String(application.applicantAccountId ?? "");
      if (!applicantId) {
        console.log("[nim] friend request ignored — missing applicant id");
        return;
      }

      console.log(`[nim] friend request received — applicant: ${applicantId}`);

      const check = isNimP2pAllowed({
        p2pPolicy,
        allowFrom,
        senderId: applicantId,
      });

      if (!check.allowed) {
        console.log(
          `[nim] friend request not auto-accepted — applicant: ${applicantId}, reason: ${check.reason ?? "policy"}`,
        );
        return;
      }

      try {
        await friendService.acceptAddApplication(application);
        console.log(`[nim] friend request auto-accepted — applicant: ${applicantId}`);
      } catch (err: any) {
        const errorMessage = err?.message ?? err?.desc ?? String(err);
        console.error(
          `[nim] friend request accept failed — applicant: ${applicantId}, error: ${errorMessage}`,
        );
      }
    });
    console.log(`[nim] friend request listener registered — policy: ${p2pPolicy}`);
  }
  if (!loginService || !messageService) {
    throw new Error("NIM SDK V2 services not available");
  }

  // 注册消息接收回调
  messageService.on("receiveMessages", (messages: any[]) => {
    console.log(`[nim] received messages — count: ${messages.length}`);
    for (const msg of messages) {
      const event = convertV2ToMessageEvent(msg);
      console.log(
        `[nim] received message — sender: ${event.from}, type: ${event.type}, session: ${event.sessionType}, target: ${event.to}, message id: ${event.msgId}, timestamp: ${event.time}`,
      );
      msgCallbackSet.forEach((cb) => cb(event));
    }
  });

  // 注册发送消息状态回调
  messageService.on("sendMessage", (msg: any) => {
    console.log(
      `[nim] send status update — message id: ${msg.messageClientId ?? "unknown"}, state: ${msg.sendingState}`,
    );
  });

  // 注册登录状态回调
  loginService.on("loginStatus", (status: number) => {
    console.log(`[nim] login status changed — status: ${status}`);
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
    const detailMessage = detail?.reason ?? detail?.desc ?? detail?.message ?? String(detail);
    console.log(`[nim] kicked offline — reason: ${detailMessage}`);
    loggedIn = false;
    connCallbackSet.forEach((cb) => cb("kickout"));
  });

  loginService.on("disconnected", (error: any) => {
    const errorMessage = error?.message ?? error?.desc ?? String(error);
    console.log(`[nim] disconnected — error: ${errorMessage}`);
    connCallbackSet.forEach((cb) => cb("disconnected"));
  });

  const instance: NimClientInstance = {
    initialized: true,
    loggedIn: false,
    account: creds.account,

    async login(): Promise<boolean> {
      try {
        console.log(`[nim] login started — account: ${creds.account}`);
        await loginService.login(creds.account, creds.token, {});
        loggedIn = true;
        instance.loggedIn = true;
        console.log(`[nim] login successful — account: ${creds.account}`);
        return true;
      } catch (error: any) {
        const errorMessage = error?.message ?? error?.desc ?? String(error);
        const errorCode = error?.code ?? error?.res_code;
        console.error(
          `[nim] login failed — error: ${errorMessage}${errorCode ? ` (code: ${errorCode})` : ""}`,
        );
        return false;
      }
    },

    async logout(): Promise<void> {
      try {
        await loginService.logout();
        loggedIn = false;
        instance.loggedIn = false;
        console.log(`[nim] logout complete — account: ${creds.account}`);
      } catch (error) {
        const errorMessage = (error as any)?.message ?? String(error);
        console.error(`[nim] logout failed — error: ${errorMessage}`);
      }
    },

    async sendText(to: string, text: string, sessionType: NimSessionType = "p2p"): Promise<NimSendResult> {
      try {
        const message = messageCreator?.createTextMessage(text);
        if (!message) {
          return { success: false, error: "Failed to create text message" };
        }

        const conversationId = buildConversationId(conversationIdUtil, to, sessionType);
        console.log(
          `[nim] sending text — target: ${conversationId}, session: ${sessionType}, length: ${text.length}`,
        );

        const result = await messageService.sendMessage(message, conversationId, {}, () => {});
        
        console.log(
          `[nim] text sent — message id: ${result.message?.messageServerId ?? "unknown"}`,
        );
        return {
          success: true,
          msgId: result.message?.messageServerId,
          clientMsgId: result.message?.messageClientId,
        };
      } catch (error: any) {
        const errorMessage = error?.message ?? error?.desc ?? String(error);
        const errorCode = error?.code ?? error?.res_code;
        console.error(
          `[nim] text send failed — error: ${errorMessage}${errorCode ? ` (code: ${errorCode})` : ""}`,
        );
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
        console.log(
          `[nim] sending image — target: ${conversationId}, session: ${sessionType}, file: ${path.basename(filePath)}`,
        );

        const result = await messageService.sendMessage(message, conversationId, {}, () => {});
        
        return {
          success: true,
          msgId: result.message?.messageServerId,
          clientMsgId: result.message?.messageClientId,
        };
      } catch (error: any) {
        const errorMessage = error?.message ?? error?.desc ?? String(error);
        const errorCode = error?.code ?? error?.res_code;
        console.error(
          `[nim] image send failed — error: ${errorMessage}${errorCode ? ` (code: ${errorCode})` : ""}`,
        );
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
        console.log(
          `[nim] sending file — target: ${conversationId}, session: ${sessionType}, file: ${path.basename(filePath)}`,
        );

        const result = await messageService.sendMessage(message, conversationId, {}, () => {});
        
        return {
          success: true,
          msgId: result.message?.messageServerId,
          clientMsgId: result.message?.messageClientId,
        };
      } catch (error: any) {
        const errorMessage = error?.message ?? error?.desc ?? String(error);
        const errorCode = error?.code ?? error?.res_code;
        console.error(
          `[nim] file send failed — error: ${errorMessage}${errorCode ? ` (code: ${errorCode})` : ""}`,
        );
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
        const errorMessage = error?.message ?? error?.desc ?? String(error);
        const errorCode = error?.code ?? error?.res_code;
        console.error(
          `[nim] audio send failed — error: ${errorMessage}${errorCode ? ` (code: ${errorCode})` : ""}`,
        );
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
        const errorMessage = error?.message ?? error?.desc ?? String(error);
        const errorCode = error?.code ?? error?.res_code;
        console.error(
          `[nim] video send failed — error: ${errorMessage}${errorCode ? ` (code: ${errorCode})` : ""}`,
        );
        return { success: false, error: error.message || String(error) };
      }
    },

    async replyText(to: string, text: string, originalMsg: unknown, forcePushAccountIds: string[], sessionType: NimSessionType = "p2p"): Promise<NimSendResult> {
      try {
        const replyMsg = messageCreator?.createTextMessage(text);
        if (!replyMsg) {
          return { success: false, error: "Failed to create reply text message" };
        }

        const sendParams = {
          pushConfig: {
            forcePush: true,
            forcePushAccountIds,
          },
        };

        const conversationId = buildConversationId(conversationIdUtil, to, sessionType);
        const textPreview = text.slice(0, 60).replace(/\s+/g, " ");
        console.log(
          `[nim] sending reply — target: ${conversationId}, session: ${sessionType}, force-push: [${forcePushAccountIds.join(", ")}], text preview: "${textPreview}"`,
        );

        const result = await messageService.replyMessage(replyMsg, originalMsg as any, sendParams, () => {});
        console.log(`[nim] reply sent — message id: ${result.message?.messageServerId ?? "unknown"}`);
        return {
          success: true,
          msgId: result.message?.messageServerId,
          clientMsgId: result.message?.messageClientId,
        };
      } catch (error: any) {
        const errorMessage = error?.message ?? error?.desc ?? String(error);
        const errorCode = error?.code ?? error?.res_code;
        console.error(
          `[nim] reply failed — error: ${errorMessage}${errorCode ? ` (code: ${errorCode})` : ""}`,
        );
        return {
          success: false,
          error: error.message || error.desc || String(error),
        };
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
