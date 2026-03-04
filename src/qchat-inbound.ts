/**
 * QChat Inbound - 圈组入站消息处理
 *
 * Parses raw QChat messages, checks @-mention, and dispatches through
 * the OpenClaw agent pipeline.
 */

import {
  createNormalizedOutboundDeliverer,
  createReplyPrefixOptions,
  formatTextWithAttachmentLinks,
  resolveOutboundMediaUrls,
  type OpenClawConfig,
  type OutboundReplyPayload,
  type RuntimeEnv,
} from "openclaw/plugin-sdk";
import { getNimRuntime } from "./runtime.js";
import type { NimConfig, QChatInboundMessage } from "./types.js";
import { resolveNimCredentials } from "./accounts.js";
import { sendQChatMessage } from "./qchat-send.js";
import type { QChatRecvMsgResp } from "node-nim";

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

  // Only handle text messages (msg_type = 0)
  if (msg.msg_type !== undefined && msg.msg_type !== 0) return null;

  const serverId = msg.server_id ?? "";
  const channelId = msg.channel_id ?? "";
  const senderAccid = msg.from_accid ?? "";
  const text = msg.msg_body ?? "";

  if (!serverId || !channelId || !senderAccid || !text.trim()) return null;

  // Detect @-mention: either @all or bot's accid is in the list
  const mentionAll = msg.mention_all === true;
  const mentionAccids = msg.mention_accids ?? [];
  const wasMentioned =
    mentionAll || mentionAccids.includes(botAccid);

  return {
    messageId: msg.msg_server_id ?? `${Date.now()}`,
    serverId,
    channelId,
    senderAccid,
    senderNick: msg.from_nick,
    text: text.trim(),
    timestamp: msg.timestamp ?? Date.now(),
    wasMentioned,
  };
}

async function deliverQChatReply(params: {
  payload: OutboundReplyPayload;
  target: string;
  accountId: string;
  statusSink?: (patch: { lastOutboundAt?: number }) => void;
}): Promise<void> {
  const combined = formatTextWithAttachmentLinks(
    params.payload.text,
    resolveOutboundMediaUrls(params.payload),
  );
  if (!combined) return;

  await sendQChatMessage(params.target, combined, {
    accountId: params.accountId,
  });
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
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
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

  const senderDisplay = message.senderNick ?? message.senderAccid;
  // Reply target = the server:channel where the message was received
  const peerId = `${message.serverId}:${message.channelId}`;

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
      kind: "group",
      id: peerId,
    },
  });

  if (!route) {
    runtime.error?.(`nim-qchat: no agent route resolved for peer ${peerId} — skipping`);
    return;
  }

  // Build envelope
  const storePath = core.channel.session.resolveStorePath(config.session?.store, {
    agentId: route.agentId,
  });
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config);
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
    body: rawBody,
  });

  // Finalize inbound context
  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: rawBody,
    CommandBody: rawBody,
    From: `nim:qchat:${message.senderAccid}`,
    To: `nim:qchat:${peerId}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: "group",
    ConversationLabel: `server:${message.serverId}/channel:${message.channelId}`,
    SenderName: senderDisplay,
    SenderId: message.senderAccid,
    GroupSubject: peerId,
    Provider: CHANNEL_ID,
    Surface: QCHAT_SURFACE,
    WasMentioned: true,
    MessageSid: message.messageId,
    Timestamp: message.timestamp,
    OriginatingChannel: CHANNEL_ID,
    OriginatingTo: `nim:qchat:${peerId}`,
    CommandAuthorized: true,
  });

  // Record inbound session
  await core.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
    ctx: ctxPayload,
    onRecordError: (err: unknown) => {
      runtime.error?.(`nim-qchat: failed updating session meta: ${String(err)}`);
    },
  });

  // Build reply deliverer — sends to the SAME server:channel
  const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
    cfg: config,
    agentId: route.agentId,
    channel: CHANNEL_ID,
    accountId,
  });
  const deliverReply = createNormalizedOutboundDeliverer(async (payload) => {
    runtime.log(`nim-qchat: delivering reply to ${peerId} (${(payload.text ?? "").slice(0, 80)}...)`);
    await deliverQChatReply({
      payload,
      target: peerId,
      accountId,
      statusSink,
    });
    runtime.log(`nim-qchat: reply delivered to ${peerId}`);
  });

  // Dispatch through the agent pipeline
  await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg: config,
    dispatcherOptions: {
      ...prefixOptions,
      deliver: deliverReply,
      onError: (err: unknown, info: { kind: string }) => {
        runtime.error?.(`nim-qchat ${info.kind} reply failed: ${String(err)}`);
      },
    },
    replyOptions: {
      onModelSelected,
    },
  });
}
