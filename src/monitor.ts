/**
 * NIM Monitor - 消息监听模块 (node-nim 版本)
 */

import type { OpenClawConfig, RuntimeEnv } from "openclaw/plugin-sdk";
import type {
  NimConfig,
  NimClientInstance,
  NimMessageEvent,
  NimP2pPolicy,
} from "./types.js";
import { createNimClient, clearNimClientCache } from "./client.js";
import { resolveNimCredentials } from "./accounts.js";
import { handleNimMessage } from "./bot.js";
import type { QChatClient } from "./qchat-client.js";
/** 监控状态 */
interface MonitorState {
  client: NimClientInstance;
  running: boolean;
  abortController: AbortController;
}

/** 监控状态缓存 */
const monitorStates = new Map<string, MonitorState>();

/**
 * 启动 NIM 消息监听
 */
export async function monitorNimProvider(params: {
  cfg: OpenClawConfig;
  runtime: RuntimeEnv;
  abortSignal?: AbortSignal;
  /** QChat client to wire into the IM login lifecycle (two-phase). */
  qchatClient?: QChatClient | null;
}): Promise<void> {
  const { cfg, runtime, abortSignal } = params;
  const nimCfg = cfg.channels?.nim as NimConfig;

  if (!nimCfg) {
    console.error("[nim] channel not configured");
    return;
  }

  const creds = resolveNimCredentials(nimCfg);
  if (!creds) {
    console.error("[nim] credentials not configured");
    return;
  }
  const monitorKey = `${creds.appKey}:${creds.account}`;

  // 检查是否已有监控在运行
  if (monitorStates.has(monitorKey)) {
    console.log(`[nim] monitor already running — account: ${creds.account}`);
    // Throw so the gateway knows this is an error rather than a clean stop
    throw new Error(`NIM monitor already running for ${creds.account}`);
  }

  console.log(`[nim] monitor starting — account: ${creds.account}`);

  try {
    // 创建客户端（IM 初始化）
    const client = await createNimClient(nimCfg);

    // Sync P2P policy to the cached client — ensures the friend request listener
    // always uses the latest policy, even when the client is reused from cache.
    const liveP2pPolicy = (nimCfg.p2p?.policy as NimP2pPolicy) ?? "open";
    const liveP2pAllowFrom = nimCfg.p2p?.allowFrom ?? [];
    client.updateP2pPolicy(liveP2pPolicy, liveP2pAllowFrom);
    // QChat phase 1: register passive listeners AFTER IM init, BEFORE login
    // 复用 IM 创建的 NIM 实例，避免重复创建
    if (params.qchatClient) {
      params.qchatClient.setNim(client.nativeNim);
      console.log("[qchat] listeners registering — phase: pre-login");
      await params.qchatClient.initListeners();
    }

    // IM 登录
    const loginSuccess = await client.login();

    if (!loginSuccess) {
      console.error("[nim] login failed — monitor not started");
      return;
    }

    console.log(`[nim] login successful — account: ${creds.account}`);

    // QChat phase 2: activate (discover servers + subscribe) AFTER login success
    if (params.qchatClient) {
      console.log("[qchat] subscriptions activating — phase: post-login");
      try {
        await params.qchatClient.activate();
        console.log("[qchat] subscriptions active");
      } catch (qchatErr) {
        const errorMessage = (qchatErr as any)?.message ?? String(qchatErr);
        console.error(`[qchat] activation failed — error: ${errorMessage}`);
        // QChat failure should not prevent IM from working
      }
    }

    // 创建 AbortController 用于停止监控
    const abortController = new AbortController();

    // 保存监控状态
    const state: MonitorState = {
      client,
      running: true,
      abortController,
    };
    monitorStates.set(monitorKey, state);

    // 注册消息处理回调
    const messageHandler = async (msg: NimMessageEvent) => {
      if (!state.running) return;

      // 忽略自己发送的消息
      if (msg.from === creds.account) {
        return;
      }

      console.log(
        `[nim] received message — sender: ${msg.from}, type: ${msg.type}, session: ${msg.sessionType}, target: ${msg.to}, message id: ${msg.msgId}, timestamp: ${msg.time}`,
      );

      try {
        await handleNimMessage({
          cfg,
          runtime,
          message: msg,
        });
      } catch (error) {
        const errorMessage = (error as any)?.message ?? String(error);
        console.error(`[nim] message handling failed — error: ${errorMessage}`);
      }
    };

    client.onMessage(messageHandler);

    // 注册连接状态回调
    client.onConnectionChange((status) => {
      console.log(`[nim] connection status changed — status: ${status}`);

      if (status === "kickout") {
        console.warn(`[nim] account kicked out — account: ${creds.account}`);
        stopNimMonitor(nimCfg);
      } else if (status === "disconnected") {
        console.warn("[nim] disconnected — reconnecting");
        // SDK 会自动重连
      }
    });

    console.log(`[nim] monitor started — account: ${creds.account}`);

    // Keep the returned Promise pending until abort signal fires.
    // The OpenClaw gateway interprets a resolved/rejected Promise as
    // "channel stopped" and triggers auto-restart. We must stay pending.
    await new Promise<void>((resolve) => {
      const onAbort = () => {
        console.log("[nim] abort signal received — stopping monitor");
        stopNimMonitor(nimCfg).finally(resolve);
      };

      if (abortSignal?.aborted) {
        onAbort();
        return;
      }

      if (abortSignal) {
        abortSignal.addEventListener("abort", onAbort, { once: true });
      }

      // Also resolve when the internal abortController fires (e.g. kickout)
      abortController.signal.addEventListener("abort", () => resolve(), {
        once: true,
      });
    });
  } catch (error) {
    const errorMessage = (error as any)?.message ?? String(error);
    console.error(`[nim] monitor start failed — error: ${errorMessage}`);
    throw error;
  }
}

/**
 * 停止 NIM 消息监听
 */
export async function stopNimMonitor(cfg: NimConfig): Promise<void> {
  const creds = resolveNimCredentials(cfg);
  if (!creds) {
    console.log("[nim] monitor stop skipped — missing credentials");
    return;
  }
  const monitorKey = `${creds.appKey}:${creds.account}`;

  const state = monitorStates.get(monitorKey);
  if (!state) {
    console.log(`[nim] monitor not running — account: ${creds.account}`);
    return;
  }

  console.log(`[nim] monitor stopping — account: ${creds.account}`);

  state.running = false;
  state.abortController.abort();

  try {
    await state.client.logout();
  } catch (error) {
    const errorMessage = (error as any)?.message ?? String(error);
    console.error(
      `[nim] logout failed during monitor stop — error: ${errorMessage}`,
    );
  }

  monitorStates.delete(monitorKey);
  console.log(`[nim] monitor stopped — account: ${creds.account}`);
}

/**
 * 检查监控是否在运行
 */
export function isNimMonitorRunning(cfg: NimConfig): boolean {
  const creds = resolveNimCredentials(cfg);
  if (!creds) return false;
  const monitorKey = `${creds.appKey}:${creds.account}`;
  const state = monitorStates.get(monitorKey);
  return state?.running ?? false;
}

/**
 * 停止所有监控
 */
export async function stopAllNimMonitors(): Promise<void> {
  console.log("[nim] stopping all monitors");

  for (const [key, state] of monitorStates.entries()) {
    state.running = false;
    state.abortController.abort();
    try {
      await state.client.logout();
    } catch (error) {
      const errorMessage = (error as any)?.message ?? String(error);
      console.error(
        `[nim] monitor stop failed — account: ${key}, error: ${errorMessage}`,
      );
    }
  }

  monitorStates.clear();
  await clearNimClientCache();

  console.log("[nim] all monitors stopped");
}
