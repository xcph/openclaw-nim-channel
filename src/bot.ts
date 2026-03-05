import type { OpenClawConfig, RuntimeEnv } from "openclaw/plugin-sdk";
import type { NimConfig, NimP2pPolicy, NimTeamPolicy, NimMessageContext, NimMessageEvent, NimMessageType, NimSessionType } from "./types.js";
import { isNimP2pAllowed, isNimTeamAllowed } from "./accounts.js";
import { getNimRuntime } from "./runtime.js";
import { downloadNimMedia, buildNimMediaPayload, inferMediaPlaceholder } from "./media.js";
import { createNimReplyDispatcher } from "./reply-dispatcher.js";

/**
 * Map node-nim message type number to typed enum.
 * node-nim msg_type: 0=text, 1=image, 2=audio, 3=video, 4=geo, 5=notification, 6=file, 10=tip, 100=custom
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
  const sessionId = isDirectMessage 
    ? `p2p-${message.from}` 
    : `team-${message.to}`;

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
    const p2pPolicy = (nimCfg?.p2pPolicy ?? "open") as NimP2pPolicy;
    const configAllowFrom = nimCfg?.allowFrom ?? [];

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

    // Team policy: open / allowlist / disabled
    const teamPolicy = (nimCfg?.teamPolicy ?? "open") as NimTeamPolicy;
    const teamAllowFrom = nimCfg?.teamAllowFrom ?? [];

    if (!isNimTeamAllowed({ teamPolicy, teamAllowFrom, senderId: ctx.senderId })) {
      log(`[nim] team sender blocked — sender: ${ctx.senderId}, policy: ${teamPolicy}`);
      return;
    }

  try {
    const core = getNimRuntime();

    // For P2P: reply target is the sender; for team: reply target is the team/group ID
    const replyTarget = isTeam ? message.to : ctx.senderId;
    const nimFrom = `nim:${ctx.senderId}`;
    const nimTo = isTeam ? `team:${message.to}` : `user:${ctx.senderId}`;
    const chatType = isTeam ? "group" : "direct";
    const peerKind = isTeam ? "group" : "dm";
    const peerId = isTeam ? message.to : ctx.senderId;
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

    const preview = ctx.text.replace(/\s+/g, " ").slice(0, 160);
    const inboundLabel = isTeam
      ? `NIM team message from ${ctx.senderId} in ${message.to}`
      : `NIM DM from ${ctx.senderId}`;

    core.system.enqueueSystemEvent(`${inboundLabel}: ${preview}`, {
      sessionKey: route.sessionKey,
      contextKey: `nim:message:${ctx.sessionId}:${ctx.id}`,
    });

    // Handle media if present
    const mediaMaxBytes = (nimCfg?.mediaMaxMb ?? 30) * 1024 * 1024;
    const mediaList = [];

    if (["image", "file", "audio", "video"].includes(ctx.type)) {
      const attachUrl = message.attach?.url;
      if (attachUrl) {
        const mediaInfo = await downloadNimMedia({
          cfg,
          url: attachUrl,
          filename: message.attach?.name,
          maxBytes: mediaMaxBytes,
          log,
        });
        if (mediaInfo) {
          mediaList.push(mediaInfo);
        }
      }
    }

    const mediaPayload = buildNimMediaPayload(mediaList);

    const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(cfg);

    const body = core.channel.reply.formatAgentEnvelope({
      channel: "NIM",
      from: ctx.senderId,
      timestamp: new Date(ctx.timestamp),
      envelope: envelopeOptions,
      body: ctx.text,
    });

    const ctxPayload = core.channel.reply.finalizeInboundContext({
      Body: body,
      RawBody: ctx.text,
      CommandBody: ctx.text,
      From: nimFrom,
      To: nimTo,
      SessionKey: route.sessionKey,
      AccountId: route.accountId,
      ChatType: chatType,
      SenderName: ctx.senderId,
      SenderId: ctx.senderId,
      Provider: "nim" as const,
      Surface: "nim" as const,
      MessageSid: ctx.id,
      Timestamp: ctx.timestamp,
      CommandAuthorized: true,
      OriginatingChannel: "nim" as const,
      OriginatingTo: nimTo,
      ...(isTeam ? { GroupSubject: message.to, WasMentioned: true } : {}),
      ...mediaPayload,
    });

    log(
      `[nim] creating reply dispatcher — target: ${replyTarget}, session: ${sessionType}, sender: ${isTeam ? ctx.senderId : "n/a"}`,
    );

    const { dispatcher, replyOptions, markDispatchIdle } = createNimReplyDispatcher({
      cfg,
      agentId: route.agentId,
      runtime: runtime as RuntimeEnv,
      senderId: replyTarget,
      sessionType,
      originalRawMsg: isTeam ? message.rawMsg : undefined,
      originalSenderId: isTeam ? ctx.senderId : undefined,
    });

    log(
      `[nim] dispatching to agent — session: ${route.sessionKey}, chat: ${chatType}, agent: ${route.agentId}`,
    );

    const { queuedFinal, counts } = await core.channel.reply.dispatchReplyFromConfig({
      ctx: ctxPayload,
      cfg,
      dispatcher,
      replyOptions,
    });

    markDispatchIdle();

    if (counts.final === 0) {
      log(`[nim] agent returned no replies — queued: ${queuedFinal}, tool: ${counts.tool}, block: ${counts.block}`);
    } else {
      log(`[nim] dispatch complete — final: ${counts.final}, tool: ${counts.tool}, block: ${counts.block}, queued: ${queuedFinal}`);
    }
  } catch (err) {
    error(`[nim] dispatch failed — error: ${String(err)}`);
    if (err instanceof Error && err.stack) {
      error(`[nim] dispatch stack — error: ${err.stack}`);
    }
  }
}
