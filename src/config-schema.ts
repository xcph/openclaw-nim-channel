import { z } from "zod";

/**
 * Coerce value to string (handles number inputs from YAML).
 * YAML may parse values like `account: 123456` as numbers.
 */
const coerceToString = z.preprocess(
  (val) => (typeof val === "number" ? String(val) : val),
  z.string(),
);

/** Union type for allow-list entries (string or number from YAML) */
const AllowEntryArray = z.array(z.union([z.string(), z.number()])).optional();

/**
 * P2P (私聊) sub-configuration.
 */
export const P2pSubConfigSchema = z.object({
  /**
   * Access policy.
   *   open      — accept messages from anyone (default)
   *   allowlist — only accept senders listed in allowFrom
   *   disabled  — reject all P2P messages
   */
  policy: z.enum(["open", "allowlist", "disabled"]).optional().default("open"),

  /** Allowed sender IDs (used when policy="allowlist") */
  allowFrom: AllowEntryArray,
});

/**
 * Team (群组) sub-configuration.
 */
export const TeamSubConfigSchema = z.object({
  /**
   * Access policy.
   *   open      — accept messages from any group (default)
   *   allowlist — only accept groups (and optionally senders) listed in allowFrom
   *   disabled  — reject all team messages
   */
  policy: z.enum(["open", "allowlist", "disabled"]).optional().default("open"),

  /**
   * Allowlist entries (used when policy="allowlist").
   * Supported formats (case-insensitive):
   *   "groupId"           — any sender in this group
   *   "groupId|accountId" — specific sender in this group
   */
  allowFrom: AllowEntryArray,
});

/**
 * Advanced (基础设置) sub-configuration.
 */
export const AdvancedSubConfigSchema = z.object({
  /** Maximum media file size in MB */
  mediaMaxMb: z.number().min(0).optional().default(30),

  /** Text chunk limit for splitting long messages */
  textChunkLimit: z.number().min(1).optional().default(4000),

  /** Enable debug logging */
  debug: z.boolean().optional().default(false),

  /** Private deployment: custom LBS URL */
  weblbsUrl: z.string().optional(),

  /** Private deployment: default WebSocket/TCP link address */
  link_web: z.string().optional(),

  /** Private deployment: NOS upload address */
  nos_uploader: z.string().optional(),

  /** Private deployment: NOS download URL format */
  nos_downloader_v2: z.string().optional(),

  /** Private deployment: whether NOS download uses HTTPS */
  nosSsl: z.boolean().optional(),

  /** Private deployment: CDN accelerate URL format */
  nos_accelerate: z.string().optional(),

  /** Private deployment: CDN accelerate host domain (empty string to disable) */
  nos_accelerate_host: z.string().optional(),
});

/**
 * QChat (圈组) sub-configuration.
 */
export const QChatSubConfigSchema = z.object({
  /**
   * Inbound message policy.
   *   open      — accept all @-mentioned messages (default)
   *   allowlist — only accept messages matching allowFrom entries
   *   disabled  — reject all inbound QChat messages
   */
  policy: z.enum(["open", "allowlist", "disabled"]).optional().default("open"),

  /**
   * Inbound message allowlist. Controls both message filtering and server invite auto-accept.
   * Empty = accept all @-mentioned messages and auto-accept all server invites.
   *
   * Supported formats (case-insensitive):
   *   "serverId"                     — any channel, any sender in this server
   *   "serverId|channelId"           — any sender in this server+channel
   *   "serverId|channelId|accountId" — specific sender in this server+channel
   *   "serverId||accountId"          — specific sender in any channel of this server
   *
   * Server IDs present in any entry are also used for subscription and invite auto-accept.
   */
  allowFrom: AllowEntryArray,
});

/**
 * NIM channel configuration schema.
 */
export const NimConfigSchema = z.object({
  /** Whether the NIM channel is enabled */
  enabled: z.boolean().optional().default(false),

  /**
   * Shorthand credential: "appKey-accid-token" (3 segments separated by `-`).
   * When present and valid, takes priority over individual appKey/account/token fields.
   */
  nimToken: z.string().optional(),

  /** NIM App Key (coerced from number if needed) */
  appKey: coerceToString.optional(),

  /** Bot account ID (coerced from number if needed) */
  account: coerceToString.optional(),

  /** Authentication token (coerced from number if needed) */
  token: coerceToString.optional(),

  /** Whether to enable anti-spam protection */
  antispamEnabled: z.boolean().optional().default(true),

  /** P2P (私聊) sub-configuration */
  p2p: P2pSubConfigSchema.optional(),

  /** Team (群组) sub-configuration */
  team: TeamSubConfigSchema.optional(),

  /** Advanced (基础设置) sub-configuration */
  advanced: AdvancedSubConfigSchema.optional(),

  /** QChat (圈组) sub-configuration */
  qchat: QChatSubConfigSchema.optional(),
});

export type { z };
