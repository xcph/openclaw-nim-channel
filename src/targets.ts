/**
 * Normalize a NIM target to a plain account ID.
 * Strips common prefixes like "nim:", "user:", etc.
 */
export function normalizeNimTarget(target: string): string | null {
  if (!target || typeof target !== "string") {
    return null;
  }

  let normalized = target.trim();

  // Remove common prefixes
  const prefixes = ["nim:", "user:", "account:", "p2p:"];
  for (const prefix of prefixes) {
    if (normalized.toLowerCase().startsWith(prefix)) {
      normalized = normalized.slice(prefix.length);
      break;
    }
  }

  normalized = normalized.trim();

  if (!normalized) {
    return null;
  }

  return normalized;
}

/**
 * Check if a string looks like a NIM account ID.
 * NIM account IDs are alphanumeric strings, typically 1-32 characters.
 */
export function looksLikeNimId(value: string): boolean {
  if (!value || typeof value !== "string") {
    return false;
  }

  const normalized = normalizeNimTarget(value);
  if (!normalized) {
    return false;
  }

  // NIM account IDs: alphanumeric, underscores, 1-32 chars
  return /^[a-zA-Z0-9_]{1,32}$/.test(normalized);
}

/**
 * Format a NIM target for display.
 */
export function formatNimTarget(target: string): string {
  const normalized = normalizeNimTarget(target);
  if (!normalized) {
    return target;
  }
  return `nim:${normalized}`;
}

/**
 * Build a session ID for a P2P conversation.
 */
export function buildP2pSessionId(account1: string, account2: string): string {
  // NIM session IDs are typically "p2p-{targetAccount}"
  return `p2p-${account2}`;
}

/**
 * Parse a session ID to extract the target account.
 */
export function parseSessionId(sessionId: string): { scene: "p2p" | "team"; targetId: string } | null {
  if (!sessionId) {
    return null;
  }

  if (sessionId.startsWith("p2p-")) {
    return {
      scene: "p2p",
      targetId: sessionId.slice(4),
    };
  }

  if (sessionId.startsWith("team-")) {
    return {
      scene: "team",
      targetId: sessionId.slice(5),
    };
  }

  // Assume P2P if no prefix
  return {
    scene: "p2p",
    targetId: sessionId,
  };
}
