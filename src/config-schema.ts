import { z } from "zod";

/**
 * Coerce value to string (handles number inputs from YAML).
 * YAML may parse values like `account: 123456` as numbers.
 */
const coerceToString = z.preprocess(
  (val) => (typeof val === "number" ? String(val) : val),
  z.string()
);

/** Union type for allow-list entries (string or number from YAML) */
const AllowEntryArray = z.array(z.union([z.string(), z.number()])).optional();


/**
 * QChat (圈组) sub-configuration.
 */
export const QChatSubConfigSchema = z.object({
  /** Whether QChat (圈组) functionality is enabled */
  enabled: z.boolean().optional().default(false),

  /** Server ID list (empty = auto-discover all joined servers) */
  serverIds: z.array(z.string()).optional(),

  /** QChat server policy: open (all servers), allowlist (only configured), disabled */
  serverPolicy: z.enum(["open", "allowlist", "disabled"]).optional().default("open"),

});

/**
 * NIM channel configuration schema.
 */
export const NimConfigSchema = z.object({
  /** Whether the NIM channel is enabled */
  enabled: z.boolean().optional().default(false),

  /** NIM App Key (coerced from number if needed) */
  appKey: coerceToString.optional(),

  /** Bot account ID (coerced from number if needed) */
  account: coerceToString.optional(),

  /** Authentication token (coerced from number if needed) */
  token: coerceToString.optional(),

  /** P2P access policy: open (default), allowlist, disabled */
  p2pPolicy: z.enum(["allowlist", "open", "disabled"]).optional().default("open"),

  /** List of allowed sender IDs for DM (used by allowlist policy) */
  allowFrom: AllowEntryArray,

  /** Team (team/superTeam) access policy */
  teamPolicy: z.enum(["open", "allowlist", "disabled"]).optional().default("open"),

  /** Allowed sender IDs in team conversations */
  teamAllowFrom: AllowEntryArray,

  /** Maximum media file size in MB */
  mediaMaxMb: z.number().min(0).optional().default(30),

  /** Text chunk limit for splitting long messages */
  textChunkLimit: z.number().min(1).optional().default(4000),


  /** Enable debug logging */
  debug: z.boolean().optional().default(false),

  /** QChat (圈组) sub-configuration */
  qchat: QChatSubConfigSchema.optional(),
});

export type { z };
