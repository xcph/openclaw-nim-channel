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
  const { cfg, to, text, originalMsg, forcePushAccountIds, sessionType = "team" } = params;
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
      `[nim] reply client status — cached: ${client ? "yes" : "no"}, logged in: ${client?.loggedIn ? "yes" : "no"}`,
    );
    if (!client || !client.loggedIn) {
      console.log("[nim] reply client initializing");
      client = await createNimClient(nimCfg);
      await client.login();
    }

    console.log(`[nim] sending reply — target: ${targetId}, session: ${sessionType}`);
    const result = await client.replyText(targetId, text, originalMsg, forcePushAccountIds, sessionType);
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
 * 发送长消息（自动分割）
 */
export async function sendLongMessageNim(params: {
  cfg: OpenClawConfig;
  to: string;
  text: string;
  sessionType?: NimSessionType;
}): Promise<NimSendResult[]> {
  const { cfg, to, text, sessionType = "p2p" } = params;
  const chunks = splitMessageIntoChunks(text, MAX_MESSAGE_LENGTH);
  const results: NimSendResult[] = [];

  for (const chunk of chunks) {
    const result = await sendMessageNim({
      cfg,
      to,
      text: chunk,
      sessionType,
    });
    results.push(result);

    // 如果发送失败，停止发送后续消息
    if (!result.success) {
      break;
    }

    // 避免发送过快
    if (chunks.length > 1) {
      await sleep(100);
    }
  }

  return results;
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
 * 获取消息（根据消息ID）
 * 注意：需要根据实际 node-nim SDK 能力实现
 */
export async function getMessageNim(params: {
  cfg: OpenClawConfig;
  msgId: string;
}): Promise<{ success: boolean; message?: unknown; error?: string }> {
  // 暂时返回不支持
  return {
    success: false,
    error: "Get message by ID is not implemented yet",
  };
}

/**
 * 将长文本分割成多条消息
 */
export function splitMessageIntoChunks(text: string, maxLength: number = MAX_MESSAGE_LENGTH): string[] {
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
 * 辅助函数：延时
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
