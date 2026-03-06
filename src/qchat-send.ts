/**
 * QChat Send - 圈组消息发送模块
 */

import { getNimRuntime } from "./runtime.js";
import { QChatClient } from "./qchat-client.js";

let sharedQChatClient: QChatClient | null = null;

/** Live policy flag — updated by channel.ts on every gateway start/reload. */
let qchatReplyEnabled = true;

export function setQchatReplyEnabled(enabled: boolean): void {
  qchatReplyEnabled = enabled;
}

export function isQchatReplyEnabled(): boolean {
  return qchatReplyEnabled;
}

/**
 * Send a text message to a QChat channel.
 * Target format: "serverId:channelId"
 */
export async function sendQChatMessage(
  to: string,
  text: string,
  opts?: { accountId?: string; replyMessage?: unknown },
): Promise<{ ok: boolean; messageId: string; error?: Error }> {
  const log = getNimRuntime().logging.getChildLogger({ channel: "nim-qchat" });

  // Hard gate: reject all sends when policy is disabled, regardless of
  // which dispatch context triggered this (catches in-flight agents from prior messages)
  if (!qchatReplyEnabled) {
    log.info(`[qchat] send suppressed — reason: policy is disabled, target: ${to}`);
    return { ok: true, messageId: "" };
  }

  const [serverId, channelId] = to.split(":");
  if (!serverId || !channelId) {
    log.error(`[qchat] invalid target — value: ${to}`);
    return {
      ok: false,
      messageId: "",
      error: new Error(`Invalid QChat target "${to}" — expected "serverId:channelId"`),
    };
  }

  if (!sharedQChatClient) {
    log.error("[qchat] send failed — reason: client not connected");
    return {
      ok: false,
      messageId: "",
      error: new Error("QChat client not connected"),
    };
  }

  const isReply = !!opts?.replyMessage;
  log.info(
    `[qchat] sending ${isReply ? "reply" : "message"} — server: ${serverId}, channel: ${channelId}, length: ${text.length}`,
  );

  const result = isReply
    ? await sharedQChatClient.replyText({ serverId, channelId, text, replyMessage: opts!.replyMessage! })
    : await sharedQChatClient.sendText({ serverId, channelId, text });
  if (!result.ok) {
    log.error(`[qchat] send failed — error: ${result.error ?? "unknown"}`);
  } else {
    log.info(`[qchat] message sent — message id: ${result.msgServerId ?? "unknown"}`);
  }
  return {
    ok: result.ok,
    messageId: result.msgServerId ?? "",
    error: result.error ? new Error(result.error) : undefined,
  };
}

export function setSharedQChatClient(client: QChatClient | null): void {
  sharedQChatClient = client;
}

export function getSharedQChatClient(): QChatClient | null {
  return sharedQChatClient;
}
