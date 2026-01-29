import type { ClawdbotConfig, RuntimeEnv } from "clawdbot/plugin-sdk";
import type { NimConfig } from "./types.js";
import { sendMessageNim, splitMessageIntoChunks } from "./send.js";

/**
 * Create a reply dispatcher for NIM messages.
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

  let isIdle = false;

  const dispatcher = async (text: string): Promise<void> => {
    const chunks = splitMessageIntoChunks(text, chunkLimit);

    for (const chunk of chunks) {
      try {
        await sendMessageNim({
          cfg,
          to: senderId,
          text: chunk,
        });
        log(`nim: sent reply chunk (${chunk.length} chars)`);
      } catch (err) {
        log(`nim: failed to send reply: ${String(err)}`);
        throw err;
      }
    }
  };

  const replyOptions = {
    channel: "nim" as const,
    targetId: senderId,
  };

  const markDispatchIdle = () => {
    isIdle = true;
  };

  return {
    dispatcher,
    replyOptions,
    markDispatchIdle,
    isIdle: () => isIdle,
  };
}
