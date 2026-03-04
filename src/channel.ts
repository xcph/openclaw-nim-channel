import type { ChannelPlugin, OpenClawConfig } from "openclaw/plugin-sdk";
import type { ResolvedNimAccount, NimConfig } from "./types.js";
import { resolveNimAccount, resolveNimCredentials, DEFAULT_NIM_ACCOUNT_ID } from "./accounts.js";
import { normalizeNimTarget, looksLikeNimId } from "./targets.js";
import { sendMessageNim } from "./send.js";
import { probeNim } from "./probe.js";
import { nimOutboundConfig } from "./outbound.js";
import { QChatClient } from "./qchat-client.js";
import { setSharedQChatClient } from "./qchat-send.js";
import { parseQChatMessage, handleQChatInbound } from "./qchat-inbound.js";

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
    chatTypes: ["direct", "group"],
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
      "- To send an image: use the `mediaUrl` or `mediaPath` parameter with an image file path (png, jpg, gif, webp).",
      "- To send a file: use `mediaUrl` or `mediaPath` with any file path.",
      "- To send audio: use `mediaUrl` or `mediaPath` with an audio file (mp3, wav, aac, m4a).",
      "- To send video: use `mediaUrl` or `mediaPath` with a video file (mp4, mov, avi, webm).",
    ],
    channelDescription: () =>
      "NIM (NetEase IM / 网易云信) is an instant messaging platform. This channel supports sending text messages, images, files, audio, and video. Use `mediaUrl` or `mediaPath` to attach media files to your messages.",
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
        qchat: {
          type: "object",
          additionalProperties: false,
          properties: {
            enabled: { type: "boolean" },
            serverIds: { type: "array", items: { type: "string" } },
          },
        },
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

      // Prepare QChat client if configured (listeners + activate handled by monitor)
      const qchatCfg = (nimCfg as Record<string, unknown> | undefined)?.qchat as
        | { enabled?: boolean; serverIds?: string[] }
        | undefined;

      let qchatClient: QChatClient | null = null;

      if (qchatCfg?.enabled && nimCfg?.appKey && nimCfg?.account) {
        const qchatLogAdapter = ctx.log
          ? {
              info: (msg: string) => ctx.log!.info(`[qchat] ${msg}`),
              error: (msg: string) => ctx.log!.error(`[qchat] ${msg}`),
              debug: ctx.log.debug
                ? (msg: string) => ctx.log!.debug!(`[qchat] ${msg}`)
                : undefined,
            }
          : undefined;

        const serverIds = qchatCfg.serverIds ?? [];
        const serverIdsLabel =
          serverIds.length > 0
            ? `servers=[${serverIds.join(",")}]`
            : "servers=auto-discover";

        ctx.log?.info(`preparing QChat client (${serverIdsLabel})`);

        qchatClient = new QChatClient({
          appKey: nimCfg.appKey as string,
          account: nimCfg.account as string,
          serverIds: serverIds.length > 0 ? serverIds : undefined,
          log: qchatLogAdapter,
          onMessage: async (resp) => {
            const raw = resp.message;
            ctx.log?.info(
              `[qchat] raw message: server_id=${raw?.server_id} channel_id=${raw?.channel_id} ` +
              `from=${raw?.from_accid} type=${raw?.msg_type} mention_all=${raw?.mention_all} ` +
              `mention_accids=${JSON.stringify(raw?.mention_accids)} body=${(raw?.msg_body ?? "").slice(0, 100)}`
            );
            const msg = parseQChatMessage(resp, nimCfg!.account as string);
            if (!msg) {
              ctx.log?.info(`[qchat] message dropped by parseQChatMessage (not text or missing fields)`);
              return;
            }

            ctx.log?.info(
              `[qchat] parsed: from=${msg.senderAccid} mentioned=${msg.wasMentioned} ` +
              `target=${msg.serverId}:${msg.channelId} text=${msg.text.slice(0, 80)}`
            );

            if (!msg.wasMentioned) {
              ctx.log?.info(`[qchat] skipped: not @-mentioned`);
              return;
            }

            if (msg.senderAccid === (nimCfg!.account as string)) {
              ctx.log?.info(`[qchat] skipped: message from self`);
              return;
            }

            ctx.log?.info(`[qchat] dispatching to agent pipeline...`);

            try {
              await handleQChatInbound({
                message: msg,
                botAccid: nimCfg!.account as string,
                accountId: ctx.accountId,
                config: ctx.cfg,
                runtime: ctx.runtime,
                statusSink: (patch) =>
                  ctx.setStatus({ accountId: ctx.accountId, ...patch }),
              });
              ctx.log?.info(`[qchat] agent pipeline completed`);
            } catch (dispatchErr) {
              ctx.log?.error(`[qchat] agent pipeline error: ${String(dispatchErr)}`);
            }
          },
          onLoginStatus: (status) => {
            ctx.log?.info(`[qchat] login status: ${JSON.stringify(status)}`);
          },
          onError: (err) => {
            ctx.log?.error(`[qchat] error: ${err.message}`);
          },
        });

        // Set shared client so sendQChatMessage can use it once activated
        setSharedQChatClient(qchatClient);
      }

      // Handle abort: stop QChat when shutting down
      if (qchatClient) {
        ctx.abortSignal.addEventListener("abort", () => {
          qchatClient!.stop().catch((err) => {
            ctx.log?.error(`[qchat] shutdown error: ${String(err)}`);
          });
          setSharedQChatClient(null);
        }, { once: true });
      }

      // Start IM monitor — QChat lifecycle (initListeners + activate) is handled inside
      return monitorNimProvider({
        cfg: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        qchatClient,
      });
    },
  },
};
