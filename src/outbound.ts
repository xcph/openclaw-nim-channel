import type { ClawdbotConfig } from "clawdbot/plugin-sdk";
import type { NimConfig } from "./types.js";
import { sendMessageNim, splitMessageIntoChunks } from "./send.js";
import { sendImageNim, sendFileNim, inferMessageType } from "./media.js";
import { normalizeNimTarget } from "./targets.js";

/**
 * Outbound message options.
 */
export type NimOutboundOptions = {
  cfg: ClawdbotConfig;
  to: string;
  text?: string;
  mediaPath?: string;
};

/**
 * Handle outbound messages for the NIM channel.
 */
export async function nimOutbound(params: NimOutboundOptions): Promise<void> {
  const { cfg, to, text, mediaPath } = params;
  const nimCfg = cfg.channels?.nim as NimConfig | undefined;

  const targetId = normalizeNimTarget(to);
  if (!targetId) {
    throw new Error(`Invalid NIM target: ${to}`);
  }

  // Send media if provided
  if (mediaPath) {
    const mediaType = inferMessageType(mediaPath);

    if (mediaType === "image") {
      await sendImageNim({ cfg, to: targetId, imagePath: mediaPath });
    } else {
      await sendFileNim({ cfg, to: targetId, filePath: mediaPath });
    }
  }

  // Send text if provided
  if (text) {
    const chunkLimit = nimCfg?.textChunkLimit ?? 4000;
    const chunks = splitMessageIntoChunks(text, chunkLimit);

    for (const chunk of chunks) {
      await sendMessageNim({ cfg, to: targetId, text: chunk });
    }
  }
}

/**
 * Create an outbound handler function for the NIM channel.
 */
export function createNimOutboundHandler(cfg: ClawdbotConfig) {
  return async (params: { to: string; text?: string; mediaPath?: string }) => {
    await nimOutbound({ cfg, ...params });
  };
}
