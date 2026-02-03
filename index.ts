import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { nimPlugin } from "./src/channel.js";
import { setNimRuntime } from "./src/runtime.js";

// Export monitor functions
export { monitorNimProvider, stopNimMonitor, isNimMonitorRunning } from "./src/monitor.js";

// Export send functions
export { sendMessageNim, editMessageNim, getMessageNim, sendLongMessageNim } from "./src/send.js";

// Export outbound functions
export { 
  nimOutboundConfig, 
  sendNimOutboundText, 
  sendNimOutboundMedia, 
  resolveNimOutboundTarget,
  nimOutbound,
  type NimOutboundResult,
} from "./src/outbound.js";

// Export media functions
export { sendImageNim, sendFileNim, sendAudioNim, sendVideoNim, downloadNimMedia } from "./src/media.js";

// Export probe function
export { probeNim, probeNimWithConnect } from "./src/probe.js";

// Export channel plugin
export { nimPlugin } from "./src/channel.js";

// Export types
export type {
  NimConfig,
  NimMessageContext,
  NimSendResult,
  NimProbeResult,
  NimMediaInfo,
  NimMessageEvent,
  NimMessageType,
  NimDmPolicy,
  ResolvedNimAccount,
} from "./src/types.js";

// Export utility functions
export { normalizeNimTarget, looksLikeNimId, formatNimTarget } from "./src/targets.js";
export { resolveNimCredentials, resolveNimAccount, isNimDmAllowed } from "./src/accounts.js";

/**
 * OpenClaw NIM Plugin
 *
 * A Clawdbot channel plugin for NetEase IM (NIM).
 */
const plugin = {
  id: "openclaw-nim",
  name: "NIM",
  description: "NetEase IM (网易云信) channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setNimRuntime(api.runtime);
    api.registerChannel({ plugin: nimPlugin });
  },
};

export default plugin;