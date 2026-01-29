import type { ClawdbotConfig, RuntimeEnv } from "clawdbot/plugin-sdk";
import type { NimConfig } from "./types.js";
import { sendMessageNim, splitMessageIntoChunks } from "./send.js";
import { sendImageNim, sendFileNim, inferMessageType } from "./media.js";
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
  cfg: ClawdbotConfig;
  agentId: string;
  runtime: RuntimeEnv;
  senderId: string;
}) {
  const { cfg, runtime, senderId } = params;
  const nimCfg = cfg.channels?.nim as NimConfig | undefined;
  const log = runtime?.log ?? console.log;
  const chunkLimit = nimCfg?.textChunkLimit ?? 4000;

  // Get the core runtime which has the full channel.reply interface
  const core = getNimRuntime();

  /**
   * Deliver function that sends a reply message to NIM.
   * Called by the SDK dispatcher for each block/tool/final reply.
   * @param payload - The reply payload containing text and/or media
   */
  const deliver = async (payload: ReplyPayload): Promise<void> => {
    const mediaList = payload.mediaUrls ?? (payload.mediaUrl ? [payload.mediaUrl] : []);
    const text = payload.text ?? "";

    log(`nim: deliver called with text=${text.length} chars, media=${mediaList.length} items`);

    // If no content, skip
    if (!text && mediaList.length === 0) {
      log(`nim: skipping empty payload`);
      return;
    }

    try {
      // Send media first if present
      if (mediaList.length > 0) {
        for (const mediaUrl of mediaList) {
          const mediaType = inferMessageType(mediaUrl);
          log(`nim: sending media to ${senderId}, type=${mediaType}, url=${mediaUrl}`);
          
          if (mediaType === "image") {
            await sendImageNim({ cfg, to: senderId, imagePath: mediaUrl });
          } else {
            await sendFileNim({ cfg, to: senderId, filePath: mediaUrl });
          }
          log(`nim: sent media to ${senderId}`);
        }
      }

      // Send text if present
      if (text) {
        const chunks = splitMessageIntoChunks(text, chunkLimit);
        for (const chunk of chunks) {
          await sendMessageNim({
            cfg,
            to: senderId,
            text: chunk,
          });
          log(`nim: sent reply chunk (${chunk.length} chars) to ${senderId}`);
        }
      }
    } catch (err) {
      log(`nim: failed to send reply: ${String(err)}`);
      throw err;
    }
  };

  // Use the SDK's createReplyDispatcherWithTyping for proper dispatcher structure
  const { dispatcher, replyOptions: sdkReplyOptions, markDispatchIdle } = 
    core.channel.reply.createReplyDispatcherWithTyping({
      deliver,
      humanDelay: { mode: "off" },
      onIdle: () => {
        log(`nim: reply dispatcher is idle`);
      },
      onError: (err: Error) => {
        log(`nim: reply dispatcher error: ${String(err)}`);
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