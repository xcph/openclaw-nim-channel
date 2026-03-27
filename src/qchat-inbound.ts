/**
 * QChat Inbound - 圈组入站消息处理
 *
 * Parses raw QChat messages, checks @-mention, and dispatches through
 * the OpenClaw agent pipeline.
 */

import type { OpenClawConfig, RuntimeEnv } from "openclaw/plugin-sdk";
import {
  createNormalizedOutboundDeliverer,
  formatTextWithAttachmentLinks,
  resolveOutboundMediaUrls,
  type OutboundReplyPayload,
} from "openclaw/plugin-sdk/reply-payload";
import { createChannelReplyPipeline } from "openclaw/plugin-sdk/channel-reply-pipeline";
import { getNimRuntime } from "./runtime.js";
import type { NimConfig, QChatInboundMessage } from "./types.js";
import { isQChatAllowed } from "./accounts.js";
import { sendQChatMessage } from "./qchat-send.js";
import {
  resolveQChatChannelName,
  resolveUserNick,
  buildConversationLabel,
} from "./name-resolver.js";
import { getCachedNimClient } from "./client.js";
type QChatMessagePayload = {
  serverId?: string;
  channelId?: string;
  fromAccount?: string;
  fromNick?: string;
  body?: string;
  type?: string;
  msgIdServer?: string;
  time?: number;
  mentionAll?: boolean;
  mentionAccids?: string[];
  server_id?: string;
  channel_id?: string;
  from_accid?: string;
  from_nick?: string;
  msg_body?: string;
  msg_type?: number | string;
  msg_server_id?: string;
  timestamp?: number;
  mention_all?: boolean;
  mention_accids?: string[];
};

type QChatRecvMsgResp = {
  message: QChatMessagePayload;
};

const CHANNEL_ID = "nim" as const;
const QCHAT_SURFACE = "nim-qchat" as const;

/**
 * Convert a raw node-nim QChatRecvMsgResp into our simplified inbound message.
 * The `botAccid` is used to detect whether the bot was @-mentioned.
 */
export function parseQChatMessage(
  resp: QChatRecvMsgResp,
  botAccid: string,
): QChatInboundMessage | null {
  const msg = resp.message;
  if (!msg) return null;

  const messageType =
    msg.type ?? (typeof msg.msg_type === "string" ? msg.msg_type : undefined);
  const legacyType =
    typeof msg.msg_type === "number" ? msg.msg_type : undefined;

  if (messageType && messageType !== "text") return null;
  if (legacyType !== undefined && legacyType !== 0) return null;

  const serverId = msg.serverId ?? msg.server_id ?? "";
  const channelId = msg.channelId ?? msg.channel_id ?? "";
  const senderAccid = msg.fromAccount ?? msg.from_accid ?? "";
  const text = msg.body ?? msg.msg_body ?? "";

  if (!serverId || !channelId || !senderAccid || !text.trim()) return null;

  // Detect @-mention: either @all or bot's accid is in the list
  const mentionAll = (msg.mentionAll ?? msg.mention_all) === true;
  const mentionAccids = msg.mentionAccids ?? msg.mention_accids ?? [];
  const wasMentioned = mentionAll || mentionAccids.includes(botAccid);

  return {
    messageId: msg.msgIdServer ?? msg.msg_server_id ?? `${Date.now()}`,
    serverId,
    channelId,
    senderAccid,
    senderNick: msg.fromNick ?? msg.from_nick,
    text: text.trim(),
    timestamp: msg.time ?? msg.timestamp ?? Date.now(),
    wasMentioned,
    mentionAccids: mentionAccids,
    rawMessage: msg,
    channelInfo: (msg as any).channelInfo, // 🔥 传递频道信息
  };
}

async function deliverQChatReply(params: {
  payload: OutboundReplyPayload;
  target: string;
  accountId: string;
  replyMessage?: unknown;
  statusSink?: (patch: { lastOutboundAt?: number }) => void;
  runtime?: RuntimeEnv;
}): Promise<void> {
  const combined = formatTextWithAttachmentLinks(
    params.payload.text,
    resolveOutboundMediaUrls(params.payload),
  );

  params.runtime?.log?.(
    `[qchat] 📤 delivering reply — target: ${params.target}, text length: ${combined?.length || 0}, has media: ${(resolveOutboundMediaUrls(params.payload) || []).length > 0}`,
  );

  if (!combined) {
    params.runtime?.log?.(`[qchat] ⚠️ skipping empty reply`);
    return;
  }

  params.runtime?.log?.(
    `[qchat] 📨 sending QChat message — content preview: "${combined.substring(0, 50)}${combined.length > 50 ? "..." : ""}"`,
  );

  await sendQChatMessage(params.target, combined, {
    accountId: params.accountId,
    replyMessage: params.replyMessage,
  });

  params.runtime?.log?.(
    `[qchat] ✅ QChat message sent successfully — target: ${params.target}`,
  );

  params.statusSink?.({ lastOutboundAt: Date.now() });
}

/**
 * Handle an inbound QChat message:
 *  1. Skip if from ourselves
 *  2. Skip if not @-mentioned (only respond to @ messages)
 *  3. Resolve agent route
 *  4. Build inbound context envelope
 *  5. Dispatch reply through OpenClaw agent pipeline
 *     → reply goes to the SAME server:channel the message came from
 */
export async function handleQChatInbound(params: {
  message: QChatInboundMessage;
  botAccid: string;
  accountId: string;
  config: OpenClawConfig;
  runtime: RuntimeEnv;
  statusSink?: (patch: {
    lastInboundAt?: number;
    lastOutboundAt?: number;
  }) => void;
}): Promise<void> {
  const { message, botAccid, accountId, config, runtime, statusSink } = params;
  const core = getNimRuntime();

  const rawBody = message.text;
  if (!rawBody) return;

  statusSink?.({ lastInboundAt: message.timestamp });

  // Skip messages from ourselves
  if (message.senderAccid === botAccid) return;

  // @-mention gate — only respond when the bot is explicitly @-mentioned
  if (!message.wasMentioned) return;

  // NOTE: Policy gate is handled upstream in channel.ts onMessage callback.
  // This function is only called after the policy check passes.
  // No duplicate policy check needed here.

  // Reply target = the server:channel where the message was received
  const peerId = `${message.serverId}:${message.channelId}`;

  // ── Resolve display names ──
  const nimCfg = config.channels?.nim as NimConfig | undefined;
  const nimClient = nimCfg ? getCachedNimClient(nimCfg) : undefined;
  const nativeNim = nimClient?.nativeNim;

  const senderDisplay = nativeNim
    ? await resolveUserNick(nativeNim, message.senderAccid, message.senderNick)
    : (message.senderNick ?? message.senderAccid);

  const channelDisplayName = nativeNim
    ? await resolveQChatChannelName(
        nativeNim,
        message.serverId,
        message.channelId,
      )
    : peerId;

  const conversationLabel = buildConversationLabel("qchat", channelDisplayName);

  // ── Resolve @-mention accids to nicknames in message text ──
  let resolvedBody = rawBody;
  const mentionAccids = message.mentionAccids ?? [];
  if (mentionAccids.length > 0 && nativeNim) {
    for (const accid of mentionAccids) {
      if (resolvedBody.includes(`@${accid}`)) {
        const nick = await resolveUserNick(nativeNim, accid);
        if (nick && nick !== accid) {
          resolvedBody = resolvedBody.split(`@${accid}`).join(`@${nick}`);
        }
      }
    }
  }

  // Record inbound activity
  core.channel.activity.record({
    channel: CHANNEL_ID,
    accountId,
    direction: "inbound",
    at: message.timestamp,
  });

  // Resolve agent route
  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: CHANNEL_ID,
    accountId,
    peer: {
      kind: "dm",
      id: `qchat-${peerId}`,
    },
  });

  if (!route) {
    runtime.error?.(`[qchat] route unresolved — target: ${peerId}`);
    return;
  }

  // 🔥 构建包含频道信息的上下文
  const channelInfo = message.channelInfo;
  let contextualBody = rawBody;

  runtime.log?.(
    `[qchat] 🔍 checking channel info — channelInfo exists: ${!!channelInfo}, has topic: ${!!channelInfo?.topic}`,
  );

  if (channelInfo) {
    runtime.log?.(
      `[qchat] 📋 channel info details — name: "${channelInfo.name}", topic: "${channelInfo.topic}", keys: [${Object.keys(channelInfo).join(", ")}]`,
    );
    runtime.log?.(
      `[qchat] 🔍 topic type: ${typeof channelInfo.topic}, topic value: "${channelInfo.topic}", topic length: ${channelInfo.topic?.length}`,
    );
  }

  runtime.log?.(
    `[qchat] 🔍 conditional check: channelInfo=${!!channelInfo}, topic=${!!channelInfo?.topic}, will use context: ${!!channelInfo?.topic}`,
  );

  if (channelInfo?.topic) {
    // 将频道主题作为上下文信息添加到消息前
    contextualBody = `[频道信息] 当前频道: "${channelInfo.name}", 主题: "${channelInfo.topic}"\n\n用户消息: ${rawBody}`;
    runtime.log?.(
      `[qchat] channel context added — channel: "${channelInfo.name}", topic: "${channelInfo.topic}"`,
    );
  } else {
    runtime.log?.(
      `[qchat] ⚠️ no channel topic available — using original message body`,
    );
  }
  // ── System event (matches bot.ts pattern) ──
  const inboundLabel = ` From ${senderDisplay} in ${channelDisplayName}`;
  core.system.enqueueSystemEvent(`${inboundLabel}`, {
    sessionKey: route.sessionKey,
    contextKey: `nim:qchat:message:${peerId}:${message.messageId}`,
  });

  // Build envelope
  const storePath = core.channel.session.resolveStorePath(
    config.session?.store,
    {
      agentId: route.agentId,
    },
  );
  const envelopeOptions =
    core.channel.reply.resolveEnvelopeFormatOptions(config);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey,
  });
  const body = core.channel.reply.formatAgentEnvelope({
    channel: "QChat",
    from: senderDisplay,
    timestamp: message.timestamp,
    previousTimestamp,
    envelope: envelopeOptions,
    body: contextualBody, // 🔥 使用包含频道信息的内容
  });

  // Finalize inbound context
  runtime.log?.(
    `[qchat] 📋 building context payload — From: nim:qchat:${message.senderAccid}, To: nim:qchat:${peerId}, SessionKey: ${route.sessionKey}, AccountId: ${route.accountId}, ChatType: group, ConversationLabel: server:${message.serverId}/channel:${message.channelId}, SenderName: ${senderDisplay}, SenderId: ${message.senderAccid}, GroupSubject: ${peerId}, Provider: ${CHANNEL_ID}, Surface: ${QCHAT_SURFACE}, WasMentioned: true, MessageSid: ${message.messageId}, Timestamp: ${message.timestamp}, OriginatingChannel: ${CHANNEL_ID}, OriginatingTo: nim:qchat:${peerId}, CommandAuthorized: true`,
  );

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: resolvedBody,
    CommandBody: resolvedBody,
    From: `nim:${message.senderAccid}`,
    To: `nim:qchat:${peerId}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: "direct",
    ConversationLabel: conversationLabel,
    SenderName: senderDisplay,
    SenderId: message.senderAccid,
    Provider: CHANNEL_ID,
    Surface: QCHAT_SURFACE,
    WasMentioned: true,
    MessageSid: message.messageId,
    Timestamp: message.timestamp,
    OriginatingChannel: CHANNEL_ID,
    OriginatingTo: `nim:qchat:${peerId}`,
    CommandAuthorized: true,
  });

  runtime.log?.(
    `[qchat] ✅ context payload finalized — Body: "${JSON.stringify(body)}", RawBody: "${JSON.stringify(rawBody)}"`,
  );

  // Record inbound session
  await core.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
    ctx: ctxPayload,
    onRecordError: (err: unknown) => {
      runtime.error?.(`[qchat] session update failed — error: ${String(err)}`);
    },
  });

  // Build reply deliverer — sends to the SAME server:channel
  const { onModelSelected, ...prefixOptions } = createChannelReplyPipeline({
    cfg: config,
    agentId: route.agentId,
    channel: CHANNEL_ID,
    accountId,
  });

  const deliverReply = createNormalizedOutboundDeliverer(async (payload) => {
    // Re-check policy at delivery time — guards against in-flight dispatches
    // that were initiated before the policy was changed.
    const liveNimCfg = config.channels?.nim as NimConfig | undefined;
    const liveQchatCfg = liveNimCfg?.qchat as
      | { policy?: string; allowFrom?: Array<string | number> }
      | undefined;
    const livePolicy = (liveQchatCfg?.policy ?? "open") as
      | "open"
      | "allowlist"
      | "disabled";
    const liveAllowFrom = liveQchatCfg?.allowFrom ?? [];

    // Use the full isQChatAllowed check — catches both literal "disabled" AND
    // "allowlist" with empty allowFrom (which is treated as disabled).
    const deliveryCheck = isQChatAllowed({
      policy: livePolicy,
      allowFrom: liveAllowFrom,
      serverId: message.serverId,
      channelId: message.channelId,
      senderAccid: message.senderAccid,
    });
    if (!deliveryCheck.allowed) {
      runtime.log(
        `[qchat] reply suppressed — reason: policy now blocks delivery (policy: ${livePolicy}), target: ${peerId}`,
      );
      return;
    }

    runtime.log(`[qchat] delivering reply — target: ${peerId}`);
    await deliverQChatReply({
      payload,
      target: peerId,
      accountId,
      replyMessage: message.rawMessage,
      statusSink,
      runtime,
    });
    runtime.log(`[qchat] reply delivered — target: ${peerId}`);
  });

  // Dispatch through the agent pipeline
  await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg: config,
    dispatcherOptions: {
      ...prefixOptions,
      deliver: deliverReply,
      onError: (err: unknown, info: { kind: string }) => {
        runtime.error?.(
          `[qchat] ${info.kind} reply failed — error: ${String(err)}`,
        );
      },
    },
    replyOptions: {
      onModelSelected,
    },
  });
}
