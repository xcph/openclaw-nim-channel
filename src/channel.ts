import type { ChannelPlugin, OpenClawConfig } from "openclaw/plugin-sdk";
import type { ResolvedNimAccount, NimConfig, NimTeamPolicy } from "./types.js";
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
      "- NIM targeting: omit `target` to reply to the current conversation (auto-inferred). Explicit targets: `user:<accountId>` for P2P, `team:<teamId>` for team group.",
      "- For group conversations, always send to the group (do NOT send P2P to individual users unless explicitly asked).",
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
        p2pPolicy: { type: "string", enum: ["open", "allowlist", "disabled"] },
        allowFrom: { type: "array", items: { oneOf: [{ type: "string" }, { type: "number" }] } },
        teamPolicy: { type: "string", enum: ["open", "allowlist", "disabled"] },
        teamAllowFrom: { type: "array", items: { oneOf: [{ type: "string" }, { type: "number" }] } },
        mediaMaxMb: { type: "number", minimum: 0 },
        textChunkLimit: { type: "integer", minimum: 1 },
        debug: { type: "boolean" },
        qchat: {
          type: "object",
          additionalProperties: false,
          properties: {
            enabled: { type: "boolean" },
            serverIds: { type: "array", items: { type: "string" } },
            serverPolicy: { type: "string", enum: ["open", "allowlist", "disabled"] },
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
    resolveDmPolicy: ({ account }) => ({
      policy: account.p2pPolicy ?? "open",
      allowFrom: account.allowFrom ?? [],
      allowFromPath: "channels.nim.",
      normalizeEntry: (raw: string) => raw.replace(/^(nim|user|account):/i, ""),
    }),
    collectWarnings: ({ cfg }) => {
      const nimCfg = cfg.channels?.nim as NimConfig | undefined;
      const warnings: string[] = [];

      // P2P policy warnings
      const p2pPolicy = nimCfg?.p2pPolicy ?? "open";
      if (p2pPolicy === "open") {
        warnings.push(
          `- NIM P2P: p2pPolicy="open" allows any user to message. Set channels.nim.p2pPolicy="allowlist" + channels.nim.allowFrom to restrict senders.`,
        );
      }

      // Team policy warnings
      const teamPolicy = nimCfg?.teamPolicy ?? "open";
      if (teamPolicy === "open") {
        const hasTeamAllowFrom = (nimCfg?.teamAllowFrom ?? []).length > 0;
        if (!hasTeamAllowFrom) {
          warnings.push(
            `- NIM teams: teamPolicy="open" allows any member to trigger (mention-gated). Set channels.nim.teamPolicy="allowlist" + channels.nim.teamAllowFrom to restrict senders.`,
          );
        }
      }

      // QChat server policy warnings
      const qchatCfg = (nimCfg as Record<string, unknown> | undefined)?.qchat as
        | { enabled?: boolean; serverPolicy?: string; serverIds?: string[] }
        | undefined;
      if (qchatCfg?.enabled) {
        const qchatServerPolicy = qchatCfg.serverPolicy ?? "open";
        if (qchatServerPolicy === "open") {
          const hasServerIds = (qchatCfg.serverIds ?? []).length > 0;
          if (hasServerIds) {
            warnings.push(
              `- QChat: serverPolicy="open" allows any server to trigger (mention-gated). Set channels.nim.qchat.serverPolicy="allowlist" to restrict to configured serverIds.`,
            );
          } else {
            warnings.push(
              `- QChat: serverPolicy="open" with no serverIds; any server can trigger (mention-gated). Set channels.nim.qchat.serverPolicy="allowlist" and configure channels.nim.qchat.serverIds.`,
            );
          }
        }
      }

      return warnings;
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
      hint: "<accountId|user:accountId|team:teamId|superTeam:teamId>",
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
      connected: snapshot.connected ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null,
    }),
    probeAccount: async ({ cfg }) =>
      await probeNim(cfg.channels?.nim as NimConfig | undefined),
    buildAccountSnapshot: ({ account, runtime, probe }) => {
      const running = runtime?.running ?? false;
      const probeConnected = (probe as { connected?: boolean } | undefined)?.connected;
      return {
        accountId: account.accountId,
        enabled: account.enabled,
        configured: account.configured,
        running,
        connected: probeConnected ?? running,
        lastStartAt: runtime?.lastStartAt ?? null,
        lastStopAt: runtime?.lastStopAt ?? null,
        lastError: runtime?.lastError ?? null,
        probe,
      };
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      const { monitorNimProvider } = await import("./monitor.js");
      const nimCfg = ctx.cfg.channels?.nim as NimConfig | undefined;
      ctx.setStatus({ accountId: ctx.accountId });
      ctx.log?.info(`[nim] provider starting — account: ${nimCfg?.account ?? "unknown"}`);

      // Prepare QChat client if configured (listeners + activate handled by monitor)
      const qchatCfg = (nimCfg as Record<string, unknown> | undefined)?.qchat as
        | { enabled?: boolean; serverIds?: string[]; serverPolicy?: string }
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

        ctx.log?.info(`[qchat] client preparing — ${serverIdsLabel}`);

        qchatClient = new QChatClient({
          appKey: nimCfg.appKey as string,
          account: nimCfg.account as string,
          serverIds: serverIds.length > 0 ? serverIds : undefined,
          log: qchatLogAdapter,
          onMessage: async (resp) => {
            const raw = resp.message;
            ctx.log?.info(
              `[qchat] received message — server: ${raw?.serverId ?? raw?.server_id ?? "unknown"}, channel: ${raw?.channelId ?? raw?.channel_id ?? "unknown"}, sender: ${raw?.fromAccount ?? raw?.from_accid ?? "unknown"}, message id: ${raw?.msgIdServer ?? raw?.msg_server_id ?? "unknown"}, timestamp: ${raw?.time ?? raw?.timestamp ?? "unknown"}`,
            );
            const msg = parseQChatMessage(resp, nimCfg!.account as string);
            if (!msg) {
              ctx.log?.info("[qchat] message dropped — reason: unsupported or missing fields");
              return;
            }

            ctx.log?.info(
              `[qchat] parsed message — sender: ${msg.senderAccid}, target: ${msg.serverId}:${msg.channelId}, mentioned: ${msg.wasMentioned ? "yes" : "no"}, message id: ${msg.messageId}`,
            );
            if (msg.senderAccid === (nimCfg!.account as string)) {
              ctx.log?.info("[qchat] skipped — reason: message from self");
              return;
            }

            // ── QChat access control ──
            const qchatServerPolicy = (qchatCfg?.serverPolicy ?? "open") as NimTeamPolicy;
            const allowedServerIds = qchatCfg?.serverIds ?? [];

            if (qchatServerPolicy === "disabled") {
              ctx.log?.info("[qchat] skipped — reason: serverPolicy is disabled");
              return;
            }

            if (qchatServerPolicy === "allowlist") {
              if (allowedServerIds.length === 0 || !allowedServerIds.includes(msg.serverId)) {
                ctx.log?.info(`[qchat] skipped — reason: server ${msg.serverId} not in serverIds allowlist`);
                return;
              }
            }

            // Mention check (always required for QChat)
            if (!msg.wasMentioned) {
              ctx.log?.info("[qchat] skipped — reason: mention required but not mentioned");
              return;
            }

            ctx.log?.info(
              `[qchat] dispatching to agent — server: ${msg.serverId}, channel: ${msg.channelId}, sender: ${msg.senderAccid}`,
            );

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
              ctx.log?.info(
                `[qchat] agent pipeline completed — server: ${msg.serverId}, channel: ${msg.channelId}`,
              );
            } catch (dispatchErr) {
              ctx.log?.error(
                `[qchat] agent pipeline error — error: ${String(dispatchErr)}`,
              );
            }
          },
          onLoginStatus: (status) => {
            ctx.log?.info(`[qchat] login status changed — status: ${typeof status === "object" ? (status as any)?.code ?? String(status) : status}`);
          },
          onError: (err) => {
            ctx.log?.error(`[qchat] error — message: ${err.message}`);
          },
        });

        // Set shared client so sendQChatMessage can use it once activated
        setSharedQChatClient(qchatClient);
      }

      // Handle abort: stop QChat when shutting down
      if (qchatClient) {
        ctx.abortSignal.addEventListener("abort", () => {
          qchatClient!.stop().catch((err) => {
            ctx.log?.error(`[qchat] shutdown failed — error: ${String(err)}`);
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
