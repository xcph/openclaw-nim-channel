import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type { NimConfig, ResolvedNimAccount, NimP2pPolicy, NimTeamPolicy } from "./types.js";

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
 * Resolve NIM account information from OpenClaw configuration.
 */
export function resolveNimAccount(params: {
  cfg: OpenClawConfig;
}): ResolvedNimAccount {
  const { cfg } = params;
  const nimCfg = cfg.channels?.nim as NimConfig | undefined;
  const creds = resolveNimCredentials(nimCfg);

  return {
    id: DEFAULT_NIM_ACCOUNT_ID,
    accountId: DEFAULT_NIM_ACCOUNT_ID,
    appKey: creds?.appKey ?? coerceToString(nimCfg?.appKey),
    account: creds?.account ?? coerceToString(nimCfg?.account),
    token: creds?.token ?? "",
    enabled: nimCfg?.enabled ?? false,
    configured: Boolean(creds),
    p2pPolicy: (nimCfg?.p2pPolicy as NimP2pPolicy) ?? "open",
    allowFrom: nimCfg?.allowFrom ?? [],
    teamPolicy: (nimCfg?.teamPolicy as NimTeamPolicy) ?? "open",
    teamAllowFrom: nimCfg?.teamAllowFrom ?? [],
    config: nimCfg ?? ({} as NimConfig),
  };
}

/**
 * Normalize an allow-list into a set for fast matching.
 * Supports wildcard "*" detection.
 */
export function normalizeNimAllowFrom(
  configAllowFrom: Array<string | number>,
): { hasWildcard: boolean; hasEntries: boolean; entries: Set<string> } {
  const combined = (configAllowFrom ?? []).map((v) => String(v).trim().toLowerCase()).filter(Boolean);

  const hasWildcard = combined.includes("*");
  const entries = new Set(combined.filter((e) => e !== "*"));

  return { hasWildcard, hasEntries: entries.size > 0, entries };
}

/**
 * Check if a sender is in the allowlist.
 */
export function resolveNimAllowlistMatch(params: {
  allowFrom: Array<string | number>;
  senderId: string;
}): { allowed: boolean; matchedEntry?: string; matchSource?: string } {
  const { senderId } = params;
  const { hasWildcard, entries } = normalizeNimAllowFrom(
    params.allowFrom,
  );

  if (hasWildcard) {
    return { allowed: true, matchedEntry: "*", matchSource: "wildcard" };
  }

  const normalizedSenderId = senderId.toLowerCase();
  if (entries.has(normalizedSenderId)) {
    return { allowed: true, matchedEntry: normalizedSenderId, matchSource: "id" };
  }

  return { allowed: false };
}

/**
 * Check if P2P message is allowed based on policy and sender.
 * Modes: open → allowlist → disabled.
 *
 * Returns:
 * - { allowed: true } — proceed with message processing
 * - { allowed: false, reason: "blocked" } — silently block
 * - { allowed: false, reason: "disabled" } — P2P disabled
 */
export function isNimP2pAllowed(params: {
  p2pPolicy: NimP2pPolicy;
  allowFrom: Array<string | number>;
  senderId: string;
}): { allowed: boolean; reason?: "blocked" | "disabled" } {
  const { p2pPolicy, senderId } = params;

  if (p2pPolicy === "disabled") {
    return { allowed: false, reason: "disabled" };
  }

  if (p2pPolicy === "open") {
    return { allowed: true };
  }

  // "allowlist" — check the allowlist
  const match = resolveNimAllowlistMatch({
    allowFrom: params.allowFrom,
    senderId,
  });

  if (match.allowed) {
    return { allowed: true };
  }

  // allowlist mode — silent block
  return { allowed: false, reason: "blocked" };
}

/**
 * Check if a team message sender is allowed based on team policy.
 */
export function isNimTeamAllowed(params: {
  teamPolicy: NimTeamPolicy;
  teamAllowFrom: Array<string | number>;
  senderId: string;
}): boolean {
  const { teamPolicy, teamAllowFrom, senderId } = params;

  if (teamPolicy === "disabled") {
    return false;
  }

  if (teamPolicy === "open") {
    return true;
  }

  // "allowlist" — check teamAllowFrom
  if (!teamAllowFrom || teamAllowFrom.length === 0) {
    return false;
  }

  const normalizedSenderId = senderId.toLowerCase();
  return teamAllowFrom.some(
    (entry) => String(entry).trim().toLowerCase() === normalizedSenderId,
  );
}
