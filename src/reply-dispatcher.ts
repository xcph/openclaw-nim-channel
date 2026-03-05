import type { OpenClawConfig, RuntimeEnv } from "openclaw/plugin-sdk";
import type { NimConfig, NimSessionType } from "./types.js";
import { sendMessageNim, replyMessageNim, splitMessageIntoChunks } from "./send.js";
import { sendImageNim, sendFileNim, sendAudioNim, sendVideoNim, inferMessageType } from "./media.js";
import { getNimRuntime } from "./runtime.js";

/**
 * Reply payload type from Clawdbot SDK
 */
type ReplyPayload = {
  text?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  channelData?: Record<string, unknown>;
};

/**
 * Create a reply dispatcher for NIM messages.
 * Uses the Clawdbot SDK's createReplyDispatcherWithTyping for proper integration.
 */
export function createNimReplyDispatcher(params: {
  cfg: OpenClawConfig;
  agentId: string;
  runtime: RuntimeEnv;
  senderId: string;
  sessionType?: NimSessionType;
  /** 原始消息的 V2NIMMessage 对象，用于群组回复引用 */
  originalRawMsg?: unknown;
  /** @ 机器人的发送者 accid，用于群组回复强制推送 */
  originalSenderId?: string;
}) {
  const { cfg, runtime, senderId, sessionType = "p2p", originalRawMsg, originalSenderId } = params;
  const nimCfg = cfg.channels?.nim as NimConfig | undefined;
  const log = runtime?.log ?? console.log;
  const chunkLimit = nimCfg?.textChunkLimit ?? 4000;

  // Get the core runtime which has the full channel.reply interface
  const core = getNimRuntime();

  log(
    `[nim] reply dispatcher created — session: ${sessionType}, sender: ${originalSenderId ?? "n/a"}`,
  );

  /**
   * Deliver function that sends a reply message to NIM.
   * Called by the SDK dispatcher for each block/tool/final reply.
   * @param payload - The reply payload containing text and/or media
   */
  const deliver = async (payload: ReplyPayload, info?: { kind: string }): Promise<void> => {
    const mediaList = payload.mediaUrls ?? (payload.mediaUrl ? [payload.mediaUrl] : []);
    const text = payload.text ?? "";

    log(`[nim] delivering reply — kind: ${info?.kind ?? "unknown"}, text length: ${text.length}, media count: ${mediaList.length}`);

    // If no content, skip
    if (!text && mediaList.length === 0) {
      log("[nim] skipping empty reply payload");
      return;
    }

    try {
      // Send media first if present
      if (mediaList.length > 0) {
        for (const mediaUrl of mediaList) {
          const mediaType = inferMessageType(mediaUrl);
          log(
            `[nim] sending media — target: ${senderId}, type: ${mediaType}, file: ${mediaUrl}`,
          );
          
          if (mediaType === "image") {
            await sendImageNim({ cfg, to: senderId, imagePath: mediaUrl });
          } else if (mediaType === "audio") {
            // For audio files, we need duration - for now use a default duration
            // In a real implementation, you might want to extract this from the file metadata
            await sendAudioNim({ cfg, to: senderId, audioPath: mediaUrl, duration: 0 });
          } else if (mediaType === "video") {
            // For video files, we need duration, width, and height - for now use defaults
            // In a real implementation, you might want to extract these from the file metadata
            await sendVideoNim({ 
              cfg, 
              to: senderId, 
              videoPath: mediaUrl, 
              duration: 0, 
              width: 1920, 
              height: 1080 
            });
          } else {
            await sendFileNim({ cfg, to: senderId, filePath: mediaUrl });
          }
          log(`[nim] media sent — target: ${senderId}`);
        }
      }

      // Send text if present
      if (text) {
        const isTeamReply = (sessionType === "team" || sessionType === "superTeam") && originalRawMsg && originalSenderId;
        log(
          `[nim] reply mode selected — session: ${sessionType}, reply: ${isTeamReply ? "quoted" : "standard"}`,
        );
        const chunks = splitMessageIntoChunks(text, chunkLimit);
        log(`[nim] reply chunking — chunks: ${chunks.length}, limit: ${chunkLimit}`);
        for (const chunk of chunks) {
          if (isTeamReply) {
            log(
              `[nim] sending reply chunk — target: ${senderId}, session: ${sessionType}, force-push: [${originalSenderId}]`,
            );
            const result = await replyMessageNim({
              cfg,
              to: senderId,
              text: chunk,
              originalMsg: originalRawMsg,
              forcePushAccountIds: [originalSenderId],
              sessionType,
            });
            log(
              `[nim] reply result — message id: ${result.msgId ?? "unknown"}, status: ${result.success ? "sent" : "failed"}`,
            );
          } else {
            const result = await sendMessageNim({
              cfg,
              to: senderId,
              text: chunk,
              sessionType,
            });
            if (!result.success) {
              log(`[nim] send failed — target: ${senderId}, error: ${result.error ?? "unknown"}`);
            }
          }
          log(
            `[nim] reply chunk sent — target: ${senderId}, length: ${chunk.length}${isTeamReply ? `, mention: ${originalSenderId}` : ""}`,
          );
        }
      }
    } catch (err) {
      log(`[nim] reply send failed — error: ${String(err)}`);
      throw err;
    }
  };

  // Use the SDK's createReplyDispatcherWithTyping for proper dispatcher structure
  const { dispatcher, replyOptions: sdkReplyOptions, markDispatchIdle } = 
    core.channel.reply.createReplyDispatcherWithTyping({
      deliver,
      humanDelay: { mode: "off" },
      onIdle: () => {
        log(`[nim] reply dispatcher idle`);
      },
      onError: (err: Error, info: { kind: string }) => {
        log(`[nim] reply dispatcher error — kind: ${info.kind}, error: ${String(err)}`);
      },
      onSkip: (_payload: unknown, info: { kind: string; reason: string }) => {
        log(`[nim] reply skipped by normalizer — kind: ${info.kind}, reason: ${info.reason}`);
      },
    });

  const replyOptions = {
    channel: "nim" as const,
    targetId: senderId,
    ...sdkReplyOptions,
  };

  return {
    dispatcher,
    replyOptions,
    markDispatchIdle,
    isIdle: () => false, // The SDK dispatcher handles idle state internally
  };
}
