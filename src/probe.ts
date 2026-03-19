/**
 * NIM Probe - 连接探测模块 (node-nim 版本)
 */

import type { NimConfig, NimProbeResult } from "./types.js";
import { resolveNimCredentials } from "./accounts.js";
import { createNimClient, getCachedNimClient } from "./client.js";

/**
 * 探测 NIM 连接状态（使用缓存的客户端）
 */
export async function probeNim(cfg: NimConfig): Promise<NimProbeResult> {
  try {
    const creds = resolveNimCredentials(cfg);
    const client = getCachedNimClient(cfg);

    if (client && client.loggedIn) {
      return {
        connected: true,
        account: creds.account,
        loginState: "connected",
      };
    }

    return {
      connected: false,
      account: creds.account,
      loginState: "not_connected",
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 探测 NIM 连接状态（尝试建立连接）
 */
export async function probeNimWithConnect(
  cfg: NimConfig,
): Promise<NimProbeResult> {
  try {
    const creds = resolveNimCredentials(cfg);

    // 尝试创建客户端并登录
    const client = await createNimClient(cfg);
    const loginSuccess = await client.login();

    if (loginSuccess) {
      return {
        connected: true,
        account: creds.account,
        loginState: "connected",
      };
    } else {
      return {
        connected: false,
        account: creds.account,
        error: "Login failed",
        loginState: "login_failed",
      };
    }
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : String(error),
      loginState: "error",
    };
  }
}

/**
 * 快速检查配置是否完整
 */
export function isNimConfigComplete(cfg: NimConfig): boolean {
  try {
    const creds = resolveNimCredentials(cfg);
    return !!(creds.appKey && creds.account && creds.token);
  } catch {
    return false;
  }
}
