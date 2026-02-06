import type { OpenClawConfig, RuntimeEnv } from "openclaw/plugin-sdk";
import type { NimConfig, NimMessageContext, NimMessageEvent, NimMessageType, NimSessionType } from "./types.js";
import { isNimDmAllowed } from "./accounts.js";
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
 * Get session type name from number.
 * node-nim session_type: 0=p2p, 1=team
 */
function getSessionTypeName(sessionType: number): "p2p" | "team" | "unknown" {
  switch (sessionType) {
    case 0:
      return "p2p";
    case 1:
      return "team";
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

  // Only process P2P messages (DM only for now)
  if (message.sessionType !== "p2p") {
    log(`nim: ignoring non-P2P message from session type: ${message.sessionType}`);
    return;
  }

  const ctx = parseNimMessageEvent(message);

  log(`nim: received message from ${ctx.senderId} (type: ${ctx.type})`);

  // Check DM policy
  const dmPolicy = nimCfg?.dmPolicy ?? "open";
  const allowFrom = nimCfg?.allowFrom ?? [];

  const allowed = isNimDmAllowed({
    dmPolicy,
    allowFrom,
    senderId: ctx.senderId,
  });

  if (!allowed) {
    log(`nim: sender ${ctx.senderId} not allowed by DM policy`);
    return;
  }

  try {
    const core = getNimRuntime();

    const nimFrom = `nim:${ctx.senderId}`;
    const nimTo = `user:${ctx.senderId}`;

    const route = core.channel.routing.resolveAgentRoute({
      cfg,
      channel: "nim",
      peer: {
        kind: "dm",
        id: ctx.senderId,
      },
    });

    const preview = ctx.text.replace(/\s+/g, " ").slice(0, 160);
    const inboundLabel = `NIM DM from ${ctx.senderId}`;

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
      ChatType: "direct",
      SenderName: ctx.senderId,
      SenderId: ctx.senderId,
      Provider: "nim" as const,
      Surface: "nim" as const,
      MessageSid: ctx.id,
      Timestamp: ctx.timestamp,
      CommandAuthorized: true,
      OriginatingChannel: "nim" as const,
      OriginatingTo: nimTo,
      ...mediaPayload,
    });

    log(`nim: ====== mediapayload ==== ${JSON.stringify(route.mediaPayload)}`);

    const { dispatcher, replyOptions, markDispatchIdle } = createNimReplyDispatcher({
      cfg,
      agentId: route.agentId,
      runtime: runtime as RuntimeEnv,
      senderId: ctx.senderId,
    });

    log(`nim: dispatching to agent (session=${route.sessionKey})`);

    const { queuedFinal, counts } = await core.channel.reply.dispatchReplyFromConfig({
      ctx: ctxPayload,
      cfg,
      dispatcher,
      replyOptions,
    });

    markDispatchIdle();

    log(`nim: dispatch complete (queuedFinal=${queuedFinal}, replies=${counts.final})`);
  } catch (err) {
    error(`nim: failed to dispatch message: ${String(err)}`);
  }
}