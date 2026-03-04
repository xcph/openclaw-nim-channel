/**
 * QChat Send - 圈组消息发送模块
 */

import { getNimRuntime } from "./runtime.js";
import { QChatClient } from "./qchat-client.js";

let sharedQChatClient: QChatClient | null = null;

/**
 * Send a text message to a QChat channel.
 * Target format: "serverId:channelId"
 */
export async function sendQChatMessage(
  to: string,
  text: string,
  opts?: { accountId?: string },
): Promise<{ ok: boolean; messageId: string; error?: Error }> {
  const log = getNimRuntime().logging.getChildLogger({ channel: "nim-qchat" });

  const [serverId, channelId] = to.split(":");
  if (!serverId || !channelId) {
    log.error(`sendQChatMessage: invalid target "${to}"`);
    return {
      ok: false,
      messageId: "",
      error: new Error(`Invalid QChat target "${to}" — expected "serverId:channelId"`),
    };
  }

  if (!sharedQChatClient) {
    log.error(`sendQChatMessage: no shared client — not connected`);
    return {
      ok: false,
      messageId: "",
      error: new Error("QChat client not connected"),
    };
  }

  log.info(`sendQChatMessage: sending to server=${serverId} channel=${channelId} text=${text.slice(0, 80)}...`);
  const result = await sharedQChatClient.sendText({ serverId, channelId, text });
  if (!result.ok) {
    log.error(`sendQChatMessage: send failed: ${result.error}`);
  } else {
    log.info(`sendQChatMessage: sent ok, msgServerId=${result.msgServerId}`);
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
