import type { ClawdbotConfig } from "clawdbot/plugin-sdk";
import type { NimConfig, ResolvedNimAccount, NimDmPolicy } from "./types.js";

/**
 * Default account ID for NIM (single account mode).
 */
export const DEFAULT_NIM_ACCOUNT_ID = "default";

/**
 * Coerce a value to string.
 * Handles cases where YAML parses numeric values (e.g., account: 123456) as numbers.
 */
function coerceToString(value: unknown): string {
  if (typeof value === "number") {
    return String(value);
  }
  return String(value ?? "");
}

/**
 * Resolve NIM credentials from configuration.
 * Returns null if required credentials are missing.
 * Automatically converts numeric values to strings (YAML may parse them as numbers).
 */
export function resolveNimCredentials(
  cfg: NimConfig | undefined,
): { appKey: string; account: string; token: string } | null {
  if (!cfg?.appKey || !cfg?.account || !cfg?.token) {
    return null;
  }
  return {
    appKey: coerceToString(cfg.appKey),
    account: coerceToString(cfg.account),
    token: coerceToString(cfg.token),
  };
}

/**
 * Resolve NIM account information from Clawdbot configuration.
 */
export function resolveNimAccount(params: {
  cfg: ClawdbotConfig;
}): ResolvedNimAccount | null {
  const { cfg } = params;
  const nimCfg = cfg.channels?.nim as NimConfig | undefined;
  const creds = resolveNimCredentials(nimCfg);

  if (!creds) {
    return null;
  }

  return {
    id: DEFAULT_NIM_ACCOUNT_ID,
    appKey: creds.appKey,
    account: creds.account,
    token: creds.token,
    enabled: nimCfg?.enabled ?? false,
    dmPolicy: (nimCfg?.dmPolicy as NimDmPolicy) ?? "open",
    allowFrom: nimCfg?.allowFrom ?? [],
  };
}

/**
 * Check if a sender is in the allowlist.
 */
export function resolveNimAllowlistMatch(params: {
  allowFrom: Array<string | number>;
  senderId: string;
}): { allowed: boolean; matchedEntry?: string | number } {
  const { allowFrom, senderId } = params;

  if (!allowFrom || allowFrom.length === 0) {
    return { allowed: false };
  }

  const normalizedSenderId = senderId.toLowerCase();

  for (const entry of allowFrom) {
    const normalizedEntry = String(entry).toLowerCase();
    if (normalizedEntry === normalizedSenderId) {
      return { allowed: true, matchedEntry: entry };
    }
  }

  return { allowed: false };
}

/**
 * Check if DM is allowed based on policy and sender.
 */
export function isNimDmAllowed(params: {
  dmPolicy: "open" | "pairing" | "allowlist";
  allowFrom: Array<string | number>;
  senderId: string;
}): boolean {
  const { dmPolicy, allowFrom, senderId } = params;

  if (dmPolicy === "open") {
    return true;
  }

  if (dmPolicy === "allowlist") {
    const match = resolveNimAllowlistMatch({ allowFrom, senderId });
    return match.allowed;
  }

  // "pairing" mode - could implement pairing logic here
  if (dmPolicy === "pairing") {
    // For now, treat pairing as allowlist
    const match = resolveNimAllowlistMatch({ allowFrom, senderId });
    return match.allowed;
  }

  return false;
}