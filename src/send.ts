/**
 * NIM Send - 消息发送模块 (node-nim 版本)
 */

import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type { NimConfig, NimSendResult, NimSessionType } from "./types.js";
import { createNimClient, getCachedNimClient } from "./client.js";
import { normalizeNimTarget } from "./targets.js";

/** 单条消息最大字符数 */
const MAX_MESSAGE_LENGTH = 5000;

/**
 * 发送文本消息
 */
export async function sendMessageNim(params: {
  cfg: OpenClawConfig;
  to: string;
  text: string;
  sessionType?: NimSessionType;
}): Promise<NimSendResult> {
  const { cfg, to, text, sessionType = "p2p" } = params;
  const nimCfg = cfg.channels?.nim as NimConfig;

  if (!nimCfg) {
    return { success: false, error: "NIM channel not configured" };
  }

  const targetId = normalizeNimTarget(to);

  try {
    let client = getCachedNimClient(nimCfg);
    if (!client || !client.loggedIn) {
      client = await createNimClient(nimCfg);
      await client.login();
    }

    return await client.sendText(targetId, text, sessionType);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 回复群组消息（引用原消息 + 强制推送给 @ 的人）
 */
export async function replyMessageNim(params: {
  cfg: OpenClawConfig;
  to: string;
  text: string;
  originalMsg: unknown;
  forcePushAccountIds: string[];
  sessionType?: NimSessionType;
}): Promise<NimSendResult> {
  const {
    cfg,
    to,
    text,
    originalMsg,
    forcePushAccountIds,
    sessionType = "team",
  } = params;
  const nimCfg = cfg.channels?.nim as NimConfig;

  if (!nimCfg) {
    console.log("[nim] reply skipped — channel not configured");
    return { success: false, error: "NIM channel not configured" };
  }

  const targetId = normalizeNimTarget(to);
  console.log(
    `[nim] reply requested — target: ${targetId}, session: ${sessionType}, force-push: [${forcePushAccountIds.join(", ")}]`,
  );

  try {
    let client = getCachedNimClient(nimCfg);
    console.log(
      `[nim] reply client — cached: ${client ? "yes" : "no"}, logged in: ${client?.loggedIn ? "yes" : "no"}`,
    );
    if (!client || !client.loggedIn) {
      console.log("[nim] reply client initializing");
      client = await createNimClient(nimCfg);
      await client.login();
    }

    console.log(
      `[nim] sending reply — target: ${targetId}, session: ${sessionType}`,
    );
    const result = await client.replyText(
      targetId,
      text,
      originalMsg,
      forcePushAccountIds,
      sessionType,
    );
    console.log(
      `[nim] reply completed — message id: ${result.msgId ?? "unknown"}, status: ${result.success ? "sent" : "failed"}`,
    );
    return result;
  } catch (error) {
    const errorMessage = (error as any)?.message ?? String(error);
    console.error(`[nim] reply exception — error: ${errorMessage}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 编辑消息（NIM 不支持真正的编辑，这里通过撤回+重发模拟）
 * 注意：这个功能可能需要根据实际 SDK 能力调整
 */
export async function editMessageNim(params: {
  cfg: OpenClawConfig;
  msgId: string;
  to: string;
  newText: string;
  sessionType?: NimSessionType;
}): Promise<NimSendResult> {
  // NIM 不支持编辑消息，直接发送新消息
  const { cfg, to, newText, sessionType = "p2p" } = params;
  return sendMessageNim({ cfg, to, text: newText, sessionType });
}

/**
 * 将长文本分割成多条消息
 */
export function splitMessageIntoChunks(
  text: string,
  maxLength: number = MAX_MESSAGE_LENGTH,
): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // 尝试在换行符处分割
    let splitIndex = remaining.lastIndexOf("\n", maxLength);

    // 如果没有换行符，尝试在空格处分割
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = remaining.lastIndexOf(" ", maxLength);
    }

    // 如果还是找不到合适的分割点，强制在 maxLength 处分割
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks;
}

/**
 * 发送流式消息（P2P）
 */
export async function sendStreamMessageNim(params: {
  cfg: OpenClawConfig;
  to: string;
  text: string;
  sessionType?: NimSessionType;
  chunkIndex: number;
  isComplete: boolean;
  baseMessage?: any; // 基础消息体，复用于整个流式会话
}): Promise<NimSendResult> {
  const {
    cfg,
    to,
    text,
    sessionType = "p2p",
    chunkIndex,
    isComplete,
    baseMessage,
  } = params;
  const nimCfg = cfg.channels?.nim as NimConfig;

  if (!nimCfg) {
    return { success: false, error: "NIM channel not configured" };
  }

  const targetId = normalizeNimTarget(to);

  try {
    let client = getCachedNimClient(nimCfg);
    if (!client || !client.loggedIn) {
      client = await createNimClient(nimCfg);
      await client.login();
    }

    // 准备流式消息参数
    const sendParams = {
      to: targetId,
      sessionType,
      baseMessage, // 传递基础消息体
      streamChunkParams: {
        text, // 流式文本内容通过 streamChunkParams 传递
        index: chunkIndex,
        finish: isComplete ? 1 : 0,
      },
    };

    // 调用 NIM SDK 的流式消息 API
    return await client.sendStreamMessage(sendParams);
  } catch (error) {
    console.error(`[nim] stream message failed — error: ${error}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 回复流式消息 (协议 30_37) - 用于群组消息的流式回复
 */
export async function replyStreamMessageNim(params: {
  cfg: OpenClawConfig;
  conversationId: string;
  text: string;
  chunkIndex: number;
  isComplete: boolean;
  baseMessage?: any; // 基础消息体，复用于整个流式会话
  replyMessage?: any; // 被回复的消息
}): Promise<NimSendResult> {
  const {
    cfg,
    conversationId,
    text,
    chunkIndex,
    isComplete,
    baseMessage,
    replyMessage,
  } = params;
  const nimCfg = cfg.channels?.nim as NimConfig;

  if (!nimCfg) {
    return { success: false, error: "NIM channel not configured" };
  }

  try {
    let client = getCachedNimClient(nimCfg);
    if (!client || !client.loggedIn) {
      client = await createNimClient(nimCfg);
      await client.login();
    }

    // 准备流式回复消息参数
    const streamChunkParams = {
      text, // 流式文本内容
      index: chunkIndex,
      finish: isComplete ? 1 : 0,
    };

    // 获取 messageService
    const messageService = client.nativeNim.V2NIMMessageService;

    // 准备消息对象 - 如果没有 baseMessage，需要先创建一个
    let message = baseMessage;
    if (!message) {
      // 第一次调用：创建基础消息体
      const messageCreator = client.nativeNim.V2NIMMessageCreator;
      message = messageCreator?.createTextMessage(text);
      if (!message) {
        return {
          success: false,
          error: "Failed to create base message",
        };
      }
    }

    const result = await messageService.replyStreamMessage(
      message, // 基础消息体（复用）
      replyMessage, // 被回复的消息
      {}, // sendMessageParams
      streamChunkParams, // 流式分片参数
    );

    return {
      success: true,
      msgId: result?.messageServerId,
      baseMessage: result,
    };
  } catch (error) {
    console.error(`[nim] reply stream message failed — error: ${error}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
