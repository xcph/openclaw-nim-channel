/**
 * NIM Send - 消息发送模块 (node-nim 版本)
 */

import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type {
  NimInstanceConfig,
  NimSendResult,
  NimSessionType,
} from "./types.js";
import { createNimClient, getCachedNimClient } from "./client.js";
import { normalizeNimTarget } from "./targets.js";
import { resolveNimAccountById, resolveAllNimAccounts } from "./accounts.js";

/**
 * Resolve the NIM instance config for a given accountId, or fall back to
 * the first configured instance if no accountId is provided.
 */
export function resolveInstCfg(
  cfg: OpenClawConfig,
  accountId?: string,
): NimInstanceConfig | null {
  if (accountId) {
    const acct = resolveNimAccountById({ cfg, accountId });
    return acct.configured ? acct.config : null;
  }
  const all = resolveAllNimAccounts({ cfg });
  return all.find((a) => a.configured)?.config ?? null;
}

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
  accountId?: string; // 🔥 Add accountId parameter
}): Promise<NimSendResult> {
  const { cfg, to, text, sessionType = "p2p", accountId } = params;
  const nimCfg = resolveInstCfg(cfg, accountId); // 🔥 Pass accountId

  if (!nimCfg) {
    return { success: false, error: "NIM channel not configured" };
  }

  const targetId = normalizeNimTarget(to);

  console.log(
    `[nim] 🔍 sendMessageNim — accountId: "${accountId ?? "none"}", target: ${targetId}, session: ${sessionType}, account in config: ${nimCfg.account}`,
  );

  try {
    let client = getCachedNimClient(nimCfg);
    if (!client || !client.loggedIn) {
      client = await createNimClient(nimCfg);
      await client.login();
    }

    console.log(
      `[nim] ✅ sendMessageNim using client — account: ${client.account}`,
    );

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
  accountId?: string; // 🔥 Add accountId parameter
}): Promise<NimSendResult> {
  const {
    cfg,
    to,
    text,
    originalMsg,
    forcePushAccountIds,
    sessionType = "team",
    accountId,
  } = params;
  const nimCfg = resolveInstCfg(cfg, accountId); // 🔥 Pass accountId

  if (!nimCfg) {
    console.log("[nim] reply skipped — channel not configured");
    return { success: false, error: "NIM channel not configured" };
  }

  const targetId = normalizeNimTarget(to);
  console.log(
    `[nim] 🔍 replyMessageNim — accountId: "${accountId ?? "none"}", target: ${targetId}, session: ${sessionType}, force-push: [${forcePushAccountIds.join(", ")}], account in config: ${nimCfg.account}`,
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
      `[nim] ✅ replyMessageNim using client — account: ${client.account}`,
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
  accountId?: string; // 🔥 Add accountId parameter
}): Promise<NimSendResult> {
  const {
    cfg,
    to,
    text,
    sessionType = "p2p",
    chunkIndex,
    isComplete,
    baseMessage,
    accountId,
  } = params;
  const nimCfg = resolveInstCfg(cfg, accountId); // 🔥 Pass accountId

  console.log(
    `[nim] 🔍 sendStreamMessageNim — accountId: "${accountId ?? "none"}", target: ${to}, session: ${sessionType}, chunk: ${chunkIndex}, complete: ${isComplete}, account in config: ${nimCfg?.account}`,
  );

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
  accountId?: string; // 🔥 Add accountId parameter
}): Promise<NimSendResult> {
  const {
    cfg,
    conversationId,
    text,
    chunkIndex,
    isComplete,
    baseMessage,
    replyMessage,
    accountId,
  } = params;
  const nimCfg = resolveInstCfg(cfg, accountId); // 🔥 Pass accountId

  console.log(
    `[nim] 🔍 replyStreamMessageNim — accountId: "${accountId ?? "none"}", conversation: ${conversationId}, chunk: ${chunkIndex}, complete: ${isComplete}, account in config: ${nimCfg?.account}`,
  );

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
