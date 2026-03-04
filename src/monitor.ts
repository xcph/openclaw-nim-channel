/**
 * NIM Monitor - 消息监听模块 (node-nim 版本)
 */

import type { OpenClawConfig, RuntimeEnv } from "openclaw/plugin-sdk";
import type { NimConfig, NimClientInstance, NimMessageEvent } from "./types.js";
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
    console.error("[NIM] Channel not configured");
    return;
  }

  const creds = resolveNimCredentials(nimCfg);
  if (!creds) {
    console.error("[NIM] Credentials not configured");
    return;
  }
  const monitorKey = `${creds.appKey}:${creds.account}`;

  // 检查是否已有监控在运行
  if (monitorStates.has(monitorKey)) {
    console.log("[NIM] Monitor already running for", creds.account);
    return;
  }

  console.log("[NIM] Starting monitor for account:", creds.account);

  try {
    // 创建客户端（IM 初始化）
    const client = await createNimClient(nimCfg);

    // QChat phase 1: register passive listeners AFTER IM init, BEFORE login
    if (params.qchatClient) {
      console.log("[NIM] Registering QChat listeners (pre-login)");
      params.qchatClient.initListeners();
    }

    // IM 登录
    const loginSuccess = await client.login();

    if (!loginSuccess) {
      console.error("[NIM] Login failed, cannot start monitor");
      return;
    }

    console.log("[NIM] Login successful, starting message listener");

    // QChat phase 2: activate (discover servers + subscribe) AFTER login success
    if (params.qchatClient) {
      console.log("[NIM] Activating QChat subscriptions (post-login)");
      try {
        await params.qchatClient.activate();
        console.log("[NIM] QChat activated successfully");
      } catch (qchatErr) {
        console.error("[NIM] QChat activation failed:", qchatErr);
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

      console.log("[NIM] Received message from:", msg.from, "type:", msg.type);

      try {
        await handleNimMessage({
          cfg,
          runtime,
          message: msg,
        });
      } catch (error) {
        console.error("[NIM] Error handling message:", error);
      }
    };

    client.onMessage(messageHandler);

    // 注册连接状态回调
    client.onConnectionChange((status) => {
      console.log("[NIM] Connection status changed:", status);

      if (status === "kickout") {
        console.warn("[NIM] Account kicked out, stopping monitor");
        stopNimMonitor(nimCfg);
      } else if (status === "disconnected") {
        console.warn("[NIM] Disconnected, will try to reconnect");
        // SDK 会自动重连
      }
    });

    // 监听外部中止信号
    if (abortSignal) {
      abortSignal.addEventListener("abort", () => {
        console.log("[NIM] Received abort signal, stopping monitor");
        stopNimMonitor(nimCfg);
      });
    }

    // 监听内部中止信号
    abortController.signal.addEventListener("abort", () => {
      state.running = false;
      client.offMessage(messageHandler);
    });

    console.log("[NIM] Monitor started successfully");
  } catch (error) {
    console.error("[NIM] Failed to start monitor:", error);
    throw error;
  }
}

/**
 * 停止 NIM 消息监听
 */
export async function stopNimMonitor(cfg: NimConfig): Promise<void> {
  const creds = resolveNimCredentials(cfg);
  if (!creds) {
    console.log("[NIM] No credentials to stop monitor");
    return;
  }
  const monitorKey = `${creds.appKey}:${creds.account}`;

  const state = monitorStates.get(monitorKey);
  if (!state) {
    console.log("[NIM] No monitor running for", creds.account);
    return;
  }

  console.log("[NIM] Stopping monitor for account:", creds.account);

  state.running = false;
  state.abortController.abort();

  try {
    await state.client.logout();
  } catch (error) {
    console.error("[NIM] Error during logout:", error);
  }

  monitorStates.delete(monitorKey);
  console.log("[NIM] Monitor stopped");
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
  console.log("[NIM] Stopping all monitors...");
  
  for (const [key, state] of monitorStates.entries()) {
    state.running = false;
    state.abortController.abort();
    try {
      await state.client.logout();
    } catch (error) {
      console.error("[NIM] Error stopping monitor:", key, error);
    }
  }

  monitorStates.clear();
  await clearNimClientCache();
  
  console.log("[NIM] All monitors stopped");
}