import { z } from "zod";

/**
 * Coerce value to string (handles number inputs from YAML).
 * YAML may parse values like `account: 123456` as numbers.
 */
const coerceToString = z.preprocess(
  (val) => (typeof val === "number" ? String(val) : val),
  z.string()
);

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

  /** DM access policy: open (allow all), allowlist (only allowed users) */
  dmPolicy: z.enum(["open", "allowlist"]).optional().default("open"),

  /** List of allowed sender IDs when dmPolicy is "allowlist" */
  allowFrom: z.array(z.union([z.string(), z.number()])).optional(),

  /** Maximum media file size in MB */
  mediaMaxMb: z.number().min(0).optional().default(30),

  /** Text chunk limit for splitting long messages */
  textChunkLimit: z.number().min(1).optional().default(4000),

  /** NIM server configuration (optional, for private deployment) */
  lbsUrl: z.string().optional(),

  /** Link server URL (optional, for private deployment) */
  linkUrl: z.string().optional(),

  /** Enable debug logging */
  debug: z.boolean().optional().default(false),
});

export type { z };