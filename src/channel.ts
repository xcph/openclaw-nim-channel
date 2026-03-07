import type { ChannelPlugin, OpenClawConfig } from "openclaw/plugin-sdk";
import type { ResolvedNimAccount, NimConfig, NimTeamPolicy } from "./types.js";
import { resolveNimAccount, resolveNimCredentials, DEFAULT_NIM_ACCOUNT_ID } from "./accounts.js";
import { normalizeNimTarget, looksLikeNimId } from "./targets.js";
import { sendMessageNim } from "./send.js";
import { probeNim } from "./probe.js";
import { nimOutboundConfig } from "./outbound.js";
import { QChatClient } from "./qchat-client.js";
import { setSharedQChatClient, setQchatReplyEnabled } from "./qchat-send.js";
import { parseQChatMessage, handleQChatInbound } from "./qchat-inbound.js";
import { isQChatAllowed } from "./accounts.js";

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
        p2p: {
          type: "object",
          additionalProperties: false,
          properties: {
            policy: { type: "string", enum: ["open", "allowlist", "disabled"] },
            allowFrom: { type: "array", items: { oneOf: [{ type: "string" }, { type: "number" }] } },
          },
        },
        team: {
          type: "object",
          additionalProperties: false,
          properties: {
            policy: { type: "string", enum: ["open", "allowlist", "disabled"] },
            allowFrom: { type: "array", items: { oneOf: [{ type: "string" }, { type: "number" }] } },
          },
        },
        advanced: {
          type: "object",
          additionalProperties: false,
          properties: {
            mediaMaxMb: { type: "number", minimum: 0 },
            textChunkLimit: { type: "integer", minimum: 1 },
            debug: { type: "boolean" },
            lbsUrls: { type: "array", items: { type: "string" } },
            linkUrl: { type: "string" },
            nosUploadLbs: { type: "string" },
            nosDownloadUrl: { type: "string" },
          },
        },
        qchat: {
          type: "object",
          additionalProperties: false,
          properties: {
            policy: { type: "string", enum: ["open", "allowlist", "disabled"] },
            allowFrom: { type: "array", items: { oneOf: [{ type: "string" }, { type: "number" }] } },
          },
        },
      },
    },
    uiHints: {
      enabled:         { order: 1,  label: "Enable" },
      appKey:          { order: 2,  label: "App Key" },
      account:         { order: 3,  label: "Account ID" },
      token:           { order: 4,  label: "Token", sensitive: true },
      p2p:             { order: 10, label: "P2P" },
      "p2p.policy":    { order: 11, label: "Message Policy" },
      "p2p.allowFrom": { order: 12, label: "Account Allowlist" },
      team:             { order: 20, label: "Team" },
      "team.policy":    { order: 21, label: "Message Policy" },
      "team.allowFrom": { order: 22, label: "Team Allowlist" },
      qchat:             { order: 30, label: "QChat" },
      "qchat.policy":    { order: 31, label: "Message Policy" },
      "qchat.allowFrom": { order: 32, label: "Server / Channel / Account Allowlist" },
      advanced:                  { order: 40, label: "Advanced", advanced: true },
      "advanced.mediaMaxMb":     { order: 41, label: "Max Media Size (MB)" },
      "advanced.textChunkLimit": { order: 42, label: "Text Chunk Limit" },
      "advanced.debug":          { order: 43, label: "Debug Mode", advanced: true },
      "advanced.lbsUrls":       { order: 50, label: "LBS URLs (Private Deploy)", advanced: true },
      "advanced.linkUrl":       { order: 51, label: "Link Server URL (Private Deploy)", advanced: true },
      "advanced.nosUploadLbs":  { order: 52, label: "NOS Upload LBS (Private Deploy)", advanced: true },
      "advanced.nosDownloadUrl": { order: 53, label: "NOS Download URL (Private Deploy)", advanced: true },
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
      (cfg.channels?.nim as NimConfig | undefined)?.p2p?.allowFrom ?? [],
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
      allowFromPath: "channels.nim.p2p.",
      normalizeEntry: (raw: string) => raw.replace(/^(nim|user|account):/i, ""),
    }),
    collectWarnings: ({ cfg }) => {
      const nimCfg = cfg.channels?.nim as NimConfig | undefined;
      const warnings: string[] = [];

      // P2P policy warnings
      const p2pPolicy = nimCfg?.p2p?.policy ?? "open";
      if (p2pPolicy === "open") {
        warnings.push(
          `- NIM P2P: p2p.policy="open" allows any user to message. Set channels.nim.p2p.policy="allowlist" + channels.nim.p2p.allowFrom to restrict senders.`,
        );
      }

      // Team policy warnings
      const teamPolicy = nimCfg?.team?.policy ?? "open";
      if (teamPolicy === "open") {
        warnings.push(
          `- NIM teams: team.policy="open" allows any group to trigger (mention-gated). Set channels.nim.team.policy="allowlist" + channels.nim.team.allowFrom to restrict by group ID.`,
        );
      }

      // QChat warnings
      const qchatCfg = (nimCfg as Record<string, unknown> | undefined)?.qchat as
        | { policy?: string; allowFrom?: unknown[] }
        | undefined;
      if (qchatCfg) {
        const qchatPolicy = qchatCfg.policy ?? "open";
        if (qchatPolicy === "open") {
          warnings.push(
            `- QChat: policy="open" accepts all @-mentioned messages and auto-accepts all server invites. Set channels.nim.qchat.policy="allowlist" + channels.nim.qchat.allowFrom to restrict.`,
          );
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

      // Prepare QChat client (listeners + activate handled by monitor).
      // QChat always starts when credentials are available — policy only controls reply behavior.
      const qchatCfg = (nimCfg as Record<string, unknown> | undefined)?.qchat as
        | { policy?: string; allowFrom?: Array<string | number> }
        | undefined;

      const qchatPolicy = (qchatCfg?.policy ?? "open") as "open" | "allowlist" | "disabled";
      const qchatAllowFrom = qchatCfg?.allowFrom ?? [];

      // Write live reply flag immediately — all in-flight dispatches check this at send time.
      // "allowlist" with empty allowFrom is treated as disabled — must not enable replies.
      const isEffectivelyDisabled = qchatPolicy === "disabled" || (qchatPolicy === "allowlist" && qchatAllowFrom.length === 0);
      setQchatReplyEnabled(!isEffectivelyDisabled);
      ctx.log?.info(`[qchat] reply enabled: ${!isEffectivelyDisabled} — policy: ${qchatPolicy}, allowFrom count: ${qchatAllowFrom.length}`);

      // Abort guard: when gateway restarts (config reload), the old onMessage callback must
      // immediately stop processing. Without this, stale closures from previous gateway
      // instances continue handling messages with outdated policy.
      let gatewayAborted = false;
      ctx.abortSignal.addEventListener("abort", () => { gatewayAborted = true; }, { once: true });

      let qchatClient: QChatClient | null = null;

      if (nimCfg?.appKey && nimCfg?.account) {
        const qchatLogAdapter = ctx.log
          ? {
              info: (msg: string) => ctx.log!.info(`[qchat] ${msg}`),
              error: (msg: string) => ctx.log!.error(`[qchat] ${msg}`),
              debug: ctx.log.debug
                ? (msg: string) => ctx.log!.debug!(`[qchat] ${msg}`)
                : undefined,
            }
          : undefined;

        // Derive server IDs from allowFrom entries (first "|"-segment of each entry).
        // Used for subscription and server invite auto-accept.
        const allowFrom = qchatCfg?.allowFrom ?? [];
        const derivedServerIds = qchatPolicy === "allowlist"
          ? [...new Set(
              allowFrom
                .map((e) => String(e).split("|")[0].trim())
                .filter(Boolean),
            )]
          : [];

        const serverIdsLabel = derivedServerIds.length > 0
          ? `servers=[${derivedServerIds.join(",")}]`
          : "servers=auto-discover";

        ctx.log?.info(`[qchat] client preparing — ${serverIdsLabel}`);

        qchatClient = new QChatClient({
          appKey: nimCfg.appKey as string,
          account: nimCfg.account as string,
          serverIds: derivedServerIds.length > 0 ? derivedServerIds : undefined,
          serverPolicy: qchatPolicy,
          serverAllowlist: derivedServerIds,
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


            // Guard: if this gateway instance was aborted (config reload / shutdown),
            // stop processing immediately. The new instance will handle messages.
            if (gatewayAborted) return;

            // Policy gate — re-read LIVE config on every message to avoid stale closure.
            // This is the authoritative gate; qchat-inbound.ts should NOT duplicate this check.
            const liveNimCfg = ctx.cfg.channels?.nim as NimConfig | undefined;
            const liveQchatCfg = (liveNimCfg as Record<string, unknown> | undefined)?.qchat as
              | { policy?: string; allowFrom?: Array<string | number> }
              | undefined;
            const livePolicy = (liveQchatCfg?.policy ?? "open") as "open" | "allowlist" | "disabled";
            const liveAllowFrom = liveQchatCfg?.allowFrom ?? [];

            const policyResult = isQChatAllowed({
              policy: livePolicy,
              allowFrom: liveAllowFrom,
              serverId: msg.serverId,
              channelId: msg.channelId,
              senderAccid: msg.senderAccid,
            });

            ctx.log?.info(
              `[qchat] policy check — policy: ${livePolicy}, server: ${msg.serverId}, channel: ${msg.channelId}, sender: ${msg.senderAccid}`,
            );

            if (!policyResult.allowed) {
              const blocked = policyResult as Exclude<typeof policyResult, { allowed: true }>;
              if (blocked.reason === "disabled") {
                ctx.log?.info(`[qchat] dispatch skipped — reason: policy disabled, server: ${msg.serverId}, channel: ${msg.channelId}, sender: ${msg.senderAccid}`);
                ctx.setStatus({ accountId: ctx.accountId, lastInboundAt: msg.timestamp });
              } else {
                ctx.log?.info(`[qchat] dispatch skipped — reason: no matching allowFrom entry, server: ${msg.serverId}, channel: ${msg.channelId}, sender: ${msg.senderAccid}, allowFrom: [${blocked.allowFrom.join(", ")}]`);
              }
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
          setQchatReplyEnabled(false);
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
