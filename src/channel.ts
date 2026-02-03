import type { ChannelPlugin, OpenClawConfig } from "openclaw/plugin-sdk";
import type { ResolvedNimAccount, NimConfig } from "./types.js";
import { resolveNimAccount, resolveNimCredentials, DEFAULT_NIM_ACCOUNT_ID } from "./accounts.js";
import { normalizeNimTarget, looksLikeNimId } from "./targets.js";
import { sendMessageNim } from "./send.js";
import { probeNim } from "./probe.js";
import { nimOutboundConfig } from "./outbound.js";

/**
 * Channel plugin metadata.
 */
const meta = {
  id: "nim",
  label: "NIM",
  selectionLabel: "NetEase IM (网易云信)",
  docsPath: "/channels/nim",
  docsLabel: "nim",
  blurb: "网易云信 IM 即时通讯。",
  aliases: ["netease", "yunxin"],
  order: 80,
} as const;

/**
 * NIM channel plugin implementation.
 */
export const nimPlugin: ChannelPlugin<ResolvedNimAccount> = {
  id: "nim",
  meta: {
    ...meta,
  },
  pairing: {
    idLabel: "nimAccountId",
    normalizeAllowEntry: (entry) => entry.replace(/^(nim|user|account):/i, ""),
    notifyApproval: async ({ cfg, id }) => {
      await sendMessageNim({
        cfg,
        to: id,
        text: "Your account has been approved to chat with this bot.",
      });
    },
  },
  capabilities: {
    chatTypes: ["direct"],
    polls: false,
    threads: false,
    media: true,
    reactions: false,
    edit: false,
    reply: false,
  },
  agentPrompt: {
    messageToolHints: () => [
      "- NIM targeting: omit `target` to reply to the current conversation (auto-inferred). Explicit targets: `user:<accountId>` or `nim:<accountId>`.",
      "- NIM supports text, image, file, audio, and video messages.",
    ],
  },
  reload: { configPrefixes: ["channels.nim"] },
  configSchema: {
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        enabled: { type: "boolean" },
        appKey: { type: "string" },
        account: { type: "string" },
        token: { type: "string" },
        dmPolicy: { type: "string", enum: ["open", "allowlist"] },
        allowFrom: { type: "array", items: { oneOf: [{ type: "string" }, { type: "number" }] } },
        mediaMaxMb: { type: "number", minimum: 0 },
        textChunkLimit: { type: "integer", minimum: 1 },
        lbsUrl: { type: "string" },
        linkUrl: { type: "string" },
        debug: { type: "boolean" },
      },
    },
  },
  config: {
    listAccountIds: () => [DEFAULT_NIM_ACCOUNT_ID],
    resolveAccount: (cfg) => resolveNimAccount({ cfg }),
    defaultAccountId: () => DEFAULT_NIM_ACCOUNT_ID,
    setAccountEnabled: ({ cfg, enabled }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        nim: {
          ...cfg.channels?.nim,
          enabled,
        },
      },
    }),
    deleteAccount: ({ cfg }) => {
      const next = { ...cfg } as OpenClawConfig;
      const nextChannels = { ...cfg.channels };
      delete (nextChannels as Record<string, unknown>).nim;
      if (Object.keys(nextChannels).length > 0) {
        next.channels = nextChannels;
      } else {
        delete next.channels;
      }
      return next;
    },
    isConfigured: (_account, cfg) =>
      Boolean(resolveNimCredentials(cfg.channels?.nim as NimConfig | undefined)),
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
    }),
    resolveAllowFrom: ({ cfg }) =>
      (cfg.channels?.nim as NimConfig | undefined)?.allowFrom ?? [],
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.toLowerCase()),
  },
  security: {
    collectWarnings: ({ cfg }) => {
      const nimCfg = cfg.channels?.nim as NimConfig | undefined;
      const dmPolicy = nimCfg?.dmPolicy ?? "open";
      if (dmPolicy !== "open") return [];
      return [
        `- NIM DMs: dmPolicy="open" allows any user to message. Set channels.nim.dmPolicy="allowlist" + channels.nim.allowFrom to restrict senders.`,
      ];
    },
  },
  setup: {
    resolveAccountId: () => DEFAULT_NIM_ACCOUNT_ID,
    applyAccountConfig: ({ cfg }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        nim: {
          ...cfg.channels?.nim,
          enabled: true,
        },
      },
    }),
  },
  messaging: {
    normalizeTarget: normalizeNimTarget,
    targetResolver: {
      looksLikeId: looksLikeNimId,
      hint: "<accountId|user:accountId|nim:accountId>",
    },
  },
  outbound: nimOutboundConfig,
  status: {
    defaultRuntime: {
      accountId: DEFAULT_NIM_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null,
    }),
    probeAccount: async ({ cfg }) =>
      await probeNim(cfg.channels?.nim as NimConfig | undefined),
    buildAccountSnapshot: ({ account, runtime, probe }) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      probe,
    }),
  },
  gateway: {
    startAccount: async (ctx) => {
      const { monitorNimProvider } = await import("./monitor.js");
      const nimCfg = ctx.cfg.channels?.nim as NimConfig | undefined;
      ctx.setStatus({ accountId: ctx.accountId });
      ctx.log?.info(`starting NIM provider for account ${nimCfg?.account ?? "unknown"}`);
      return monitorNimProvider({
        cfg: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
      });
    },
  },
};
