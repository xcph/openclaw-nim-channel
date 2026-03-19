import {
  createNormalizedOutboundDeliverer,
  createReplyPrefixOptions,
  formatTextWithAttachmentLinks,
  resolveOutboundMediaUrls,
  type OpenClawConfig,
  type OutboundReplyPayload,
  type RuntimeEnv,
} from "openclaw/plugin-sdk";
import type {
  NimConfig,
  NimP2pPolicy,
  NimTeamPolicy,
  NimMessageContext,
  NimMessageEvent,
  NimMessageType,
  NimSessionType,
} from "./types.js";
import { isNimP2pAllowed, isNimTeamAllowed } from "./accounts.js";
import { getNimRuntime } from "./runtime.js";
import { buildNimMediaPayload, inferMediaPlaceholder } from "./media.js";
import { sendMessageNim, replyMessageNim, splitMessageIntoChunks } from "./send.js";
import { resolveUserNick, resolveTeamName, buildConversationLabel } from "./name-resolver.js";
import { getCachedNimClient } from "./client.js";

/**
 * Map message type number to typed enum.
 */
function mapMessageType(msgType: number): NimMessageType {
  switch (msgType) {
    case 0:
      return "text";
    case 1:
      return "image";
    case 2:
      return "audio";
    case 3:
      return "video";
    case 4:
      return "geo";
    case 5:
      return "notification";
    case 6:
      return "file";
    case 10:
      return "tip";
    case 100:
      return "custom";
    default:
      return "unknown";
  }
}

/**
 * Extract text content from a NIM message.
 */
function extractMessageContent(message: NimMessageEvent): string {
  if (message.type === "text" && message.text) {
    return message.text;
  }

  if (message.type === "geo" && message.attach) {
    const geo = message.attach;
    return `[位置] ${geo.title ?? ""} (${geo.lat}, ${geo.lng})`;
  }

  if (message.type === "custom" && message.ext) {
    try {
      const parsed = message.ext;
      return (parsed as any).text || (parsed as any).content || JSON.stringify(parsed);
    } catch {
      return String(message.ext);
    }
  }

  // For media messages, return a placeholder with URL
  if (["image", "file", "audio", "video"].includes(message.type)) {
    const placeholder = inferMediaPlaceholder(message.type);
    const url = message.attach?.url;
    return url ? `${placeholder} ${url}` : placeholder;
  }

  return message.text || "";
}

/**
 * Parse a NIM message event into a message context.
 */
export function parseNimMessageEvent(message: NimMessageEvent): NimMessageContext {
  const isDirectMessage = message.sessionType === "p2p";
  const sessionId = isDirectMessage ? `p2p-${message.from}` : `team-${message.to}`;

  return {
    id: message.clientMsgId,
    sessionId,
    sessionType: message.sessionType,
    senderId: message.from,
    type: message.type,
    text: extractMessageContent(message),
    timestamp: message.time,
    isDm: isDirectMessage,
    rawEvent: message,
  };
}

/**
 * Handle an incoming NIM message.
 * Supports P2P (DM) and team (group) messages.
 * Team messages are only processed when forcePushAccountIds includes the bot account.
 */
export async function handleNimMessage(params: {
  cfg: OpenClawConfig;
  message: NimMessageEvent;
  runtime?: RuntimeEnv;
}): Promise<void> {
  const { cfg, message, runtime } = params;
  const nimCfg = cfg.channels?.nim as NimConfig | undefined;
  const log = runtime?.log ?? console.log;
  const error = runtime?.error ?? console.error;
  const botAccount = nimCfg?.account ? String(nimCfg.account) : "";

  const isP2P = message.sessionType === "p2p";
  const isTeam = message.sessionType === "team" || message.sessionType === "superTeam";

  if (!isP2P && !isTeam) {
    log(`[nim] ignoring message — session: ${message.sessionType}`);
    return;
  }

  // For team messages, only process when forcePushAccountIds includes the bot
  if (isTeam) {
    const forcePushIds = message.forcePushAccountIds ?? [];
    if (!forcePushIds.includes(botAccount)) {
      log(`[nim] ignoring team message — reason: bot not in force-push list`);
      return;
    }
    log(`[nim] team message accepted — reason: bot in force-push list`);
  }

  const ctx = parseNimMessageEvent(message);

  log(
    `[nim] received message — sender: ${ctx.senderId}, type: ${ctx.type}, session: ${ctx.sessionType}, target: ${isTeam ? message.to : ctx.senderId}, message id: ${ctx.id}, timestamp: ${ctx.timestamp}`,
  );

  // ── Access control ──
  if (isP2P) {
    // P2P policy: open / allowlist / disabled
    const p2pPolicy = (nimCfg?.p2p?.policy ?? "open") as NimP2pPolicy;
    const configAllowFrom = nimCfg?.p2p?.allowFrom ?? [];

    const result = isNimP2pAllowed({
      p2pPolicy,
      allowFrom: configAllowFrom,
      senderId: ctx.senderId,
    });

    if (!result.allowed) {
      if (result.reason === "disabled") {
        log(`[nim] p2p disabled — sender: ${ctx.senderId}`);
      } else {
        log(`[nim] p2p blocked — sender: ${ctx.senderId}, policy: ${p2pPolicy}`);
      }
      return;
    }
  }

  if (isTeam) {
    // Team policy: open / allowlist (by group ID + optional sender) / disabled
    const teamPolicy = (nimCfg?.team?.policy ?? "open") as NimTeamPolicy;
    const teamIds = nimCfg?.team?.allowFrom ?? [];

    if (
      !isNimTeamAllowed({
        teamPolicy,
        teamIds,
        groupId: message.to,
        senderId: ctx.senderId,
        sessionType: message.sessionType as "team" | "superTeam",
      })
    ) {
      log(`[nim] team message blocked — group: ${message.to}, sender: ${ctx.senderId}, policy: ${teamPolicy}`);
      return;
    }
  }

  try {
    const core = getNimRuntime();

    // For P2P: reply target is the sender; for team: reply target is the team/group ID
    const replyTarget = isTeam ? message.to : ctx.senderId;
    const nimFrom = `nim:${ctx.senderId}`;
    const nimTo = isTeam ? `team:${message.to}` : `user:${ctx.senderId}`;
    const chatType = "direct";
    const peerKind = "dm";
    const peerId = isTeam ? `team-${message.to}` : ctx.senderId;
    const sessionType: NimSessionType = isTeam ? message.sessionType : "p2p";

    const route = core.channel.routing.resolveAgentRoute({
      cfg,
      channel: "nim",
      peer: {
        kind: peerKind,
        id: peerId,
      },
    });

    if (!route) {
      log(`[nim] route unresolved — peer: ${peerId}`);
      return;
    }

    // Handle media if present
    const mediaMaxBytes = (nimCfg?.advanced?.mediaMaxMb ?? 30) * 1024 * 1024;
    const mediaList = [];

    if (["image", "file", "audio", "video"].includes(ctx.type)) {
      const attachUrl = message.attach?.url;
      if (attachUrl) {
        const mediaInfo = {
          type: ctx.type as "image" | "file" | "audio" | "video",
          url: attachUrl,
          name: message.attach?.name,
          size: message.attach?.size,
        };
        mediaList.push(mediaInfo);
      }
    }

    const mediaPayload = buildNimMediaPayload(mediaList);

    // ── Resolve display names ──
    // (must happen before system event so labels use nicknames)
    const nimClient = getCachedNimClient(nimCfg!);
    const nativeNim = nimClient?.nativeNim;

    const senderDisplayName = nativeNim
      ? await resolveUserNick(nativeNim, ctx.senderId, message.fromNick)
      : message.fromNick || ctx.senderId;

    let conversationLabel: string;
    let groupSubject: string | undefined;
    let teamName: string | undefined;

    if (isTeam) {
      teamName = nativeNim
        ? await resolveTeamName(nativeNim, message.to, message.sessionType as "team" | "superTeam")
        : message.to;
      log(`[nim] resolved team name — teamId: ${message.to}, teamName: ${teamName}, hasNativeNim: ${!!nativeNim}`);
      conversationLabel = buildConversationLabel("team", teamName);
      groupSubject = buildConversationLabel("team", teamName);
    } else {
      conversationLabel = buildConversationLabel("p2p", senderDisplayName);
    }

    // ── System event (uses resolved display names) ──
    const preview = ctx.text.replace(/\s+/g, " ").slice(0, 160);
    const inboundLabel = isTeam
      ? ` From ${senderDisplayName} in ${teamName ?? message.to}`
      : ` From ${senderDisplayName}`;

    core.system.enqueueSystemEvent(`${inboundLabel}`, {
      sessionKey: route.sessionKey,
      contextKey: `nim:message:${ctx.sessionId}:${ctx.id}`,
    });

    const ctxPayload = core.channel.reply.finalizeInboundContext({
      Body: ctx.text,
      RawBody: ctx.text,
      CommandBody: ctx.text,
      From: nimFrom,
      To: nimTo,
      SessionKey: route.sessionKey,
      AccountId: route.accountId,
      ChatType: chatType,
      ConversationLabel: conversationLabel,
      SenderName: senderDisplayName,
      SenderId: ctx.senderId,
      Provider: "nim" as const,
      Surface: "nim" as const,
      MessageSid: ctx.id,
      Timestamp: ctx.timestamp,
      CommandAuthorized: true,
      OriginatingChannel: "nim" as const,
      OriginatingTo: nimTo,
      ...(isTeam ? { GroupSubject: groupSubject ?? message.to, WasMentioned: true } : {}),
      ...mediaPayload,
    });

    // ── Record inbound session ──
    const storePath = core.channel.session.resolveStorePath(cfg.session?.store, {
      agentId: route.agentId,
    });

    await core.channel.session.recordInboundSession({
      storePath,
      sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
      ctx: ctxPayload,
      onRecordError: (err: unknown) => {
        error(`[nim] session update failed — error: ${String(err)}`);
      },
    });

    // ── Build reply deliverer ──
    const accountId = route.accountId;
    const chunkLimit = nimCfg?.advanced?.textChunkLimit ?? 4000;
    const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
      cfg,
      agentId: route.agentId,
      channel: "nim",
      accountId,
    });

    const deliverReply = createNormalizedOutboundDeliverer(async (payload: OutboundReplyPayload) => {
      const combined = formatTextWithAttachmentLinks(payload.text, resolveOutboundMediaUrls(payload));
      if (!combined) return;

      log(`[nim] delivering reply — target: ${replyTarget}, session: ${sessionType}`);

      const isTeamReply = isTeam && message.rawMsg && ctx.senderId;
      const chunks = splitMessageIntoChunks(combined, chunkLimit);

      for (const chunk of chunks) {
        if (isTeamReply) {
          await replyMessageNim({
            cfg,
            to: replyTarget,
            text: chunk,
            originalMsg: message.rawMsg,
            forcePushAccountIds: [ctx.senderId],
            sessionType,
          });
        } else {
          await sendMessageNim({
            cfg,
            to: replyTarget,
            text: chunk,
            sessionType,
          });
        }
      }

      log(`[nim] reply delivered — target: ${replyTarget}`);
    });

    log(`[nim] dispatching to agent — session: ${route.sessionKey}, chat: ${chatType}, agent: ${route.agentId}`);

    // ── Dispatch through agent pipeline (same pattern as QChat) ──
    await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
      ctx: ctxPayload,
      cfg,
      dispatcherOptions: {
        ...prefixOptions,
        deliver: deliverReply,
        onError: (err: unknown, info: { kind: string }) => {
          error(`[nim] ${info.kind} reply failed — error: ${String(err)}`);
        },
      },
      replyOptions: {
        onModelSelected,
      },
    });

    log(`[nim] dispatch complete — session: ${route.sessionKey}`);
  } catch (err) {
    error(`[nim] dispatch failed — error: ${String(err)}`);
    if (err instanceof Error && err.stack) {
      error(`[nim] dispatch stack — error: ${err.stack}`);
    }
  }
}
