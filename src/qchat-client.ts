/**
 * QChat Client - 圈组客户端封装
 *
 * 使用 V2 IM 登录后，QChat 功能已内部融合，不需要单独初始化和登录。
 * 本模块仅使用 QChat 类进行 server/channel 订阅和消息收发。
 *
 * Two-phase lifecycle:
 *   1. initListeners() — register passive event handlers (call AFTER IM init, BEFORE login)
 *   2. activate()      — discover servers & subscribe (call AFTER IM login succeeds)
 */

import { QChat, type QChatRecvMsgResp, type QChatRecvSystemNotificationResp } from "node-nim";

export type QChatClientOptions = {
  appKey: string;
  account: string;
  /**
   * Server IDs to subscribe to. If empty, the client will auto-discover
   * all joined servers via getServersByPage and subscribe to all of them.
   */
  serverIds?: string[];
  onMessage?: (msg: QChatRecvMsgResp) => void | Promise<void>;
  onLoginStatus?: (status: unknown) => void;
  onError?: (error: Error) => void;
  log?: {
    info: (msg: string) => void;
    error: (msg: string) => void;
    debug?: (msg: string) => void;
  };
};

/**
 * Manages QChat subscriptions and messaging.
 *
 * Unlike the standalone QChat plugin, this client does NOT init or login QChat separately.
 * V2 IM login already covers QChat initialization internally.
 *
 * Two-phase lifecycle:
 *   Phase 1 — initListeners(): Register passive event handlers (message, system notification,
 *             login status, kick). Safe to call before IM login completes.
 *   Phase 2 — activate(): Discover servers + subscribe channels. MUST be called only
 *             after IM login succeeds, because these are active API calls.
 */
export class QChatClient {
  private qchat: QChat;
  private opts: QChatClientOptions;
  private subscribedServerIds: string[] = [];
  private listenersInitialized = false;
  private activated = false;

  constructor(opts: QChatClientOptions) {
    this.opts = opts;
    this.qchat = new QChat();
  }

  /** The accid this client is associated with. */
  get account(): string {
    return this.opts.account;
  }

  /** Whether listeners have been registered (phase 1 complete). */
  get isListening(): boolean {
    return this.listenersInitialized;
  }

  /** Whether active subscriptions are in place (phase 2 complete). */
  get isActivated(): boolean {
    return this.activated;
  }

  /**
   * Phase 1 — Register passive event handlers.
   *
   * Call this AFTER V2NIMClient.init() but BEFORE loginService.login().
   * Only registers listeners; makes NO outgoing API calls.
   */
  initListeners(): void {
    if (this.listenersInitialized) return;

    const log = this.opts.log;

    // Initialize QChat event handler infrastructure
    this.qchat.initEventHandlers();
    log?.info("event handlers initialized — v2 login provides qchat auth");

    // Login status
    this.qchat.instance.on("loginStatus", (resp: unknown) => {
      this.opts.onLoginStatus?.(resp);
    });

    // Kicked out
    this.qchat.instance.on("kickedOut", (resp: unknown) => {
      this.opts.onError?.(new Error(`kicked out — reason: ${typeof resp === "object" && resp !== null ? ((resp as any).code ?? (resp as any).reason ?? String(resp)) : String(resp)}`));
    });

    // Message listener (fires for ALL subscribed channels)
    this.qchat.message.on("message", (resp: QChatRecvMsgResp) => {
      this.opts.onMessage?.(resp);
    });

    // System notification listener
    // When the bot is invited to a new server (MemberInviteDone = 8),
    // automatically subscribe to all channels in that server.
    this.qchat.systemNotification.on("notification", (resp: QChatRecvSystemNotificationResp) => {
      const notification = resp.notification;
      if (!notification) return;

      // kNIMQChatSystemNotificationTypeMemberInviteDone = 8
      if (notification.msg_type === 8) {
        const serverId = notification.server_id;
        if (!serverId) return;

        // Skip if already subscribed
        if (this.subscribedServerIds.includes(serverId)) {
          log?.info(`[sysnotify] invite received — server: ${serverId}, status: already subscribed`);
          return;
        }

        if (!this.activated) {
          log?.info(`[sysnotify] invite queued — server: ${serverId}, status: not activated`);
          return;
        }

        log?.info(`[sysnotify] auto-subscribing — server: ${serverId}`);
        this.subscribeServer(serverId).catch((err) => {
          log?.error(`[sysnotify] subscribe failed — server: ${serverId}, error: ${String(err)}`);
        });
      }
    });

    this.listenersInitialized = true;
    log?.info("listeners registered — phase: passive");
  }

  /**
   * Phase 2 — Discover servers and subscribe to channels.
   *
   * Call this AFTER IM login succeeds. Makes active API calls
   * (getServersByPage, subscribeAllChannel) that require authentication.
   */
  async activate(): Promise<void> {
    if (this.activated) return;
    if (!this.listenersInitialized) {
      this.initListeners();
    }

    const log = this.opts.log;

    // Resolve which servers to subscribe to
    let serverIds = this.opts.serverIds ?? [];

    if (serverIds.length === 0) {
      // Auto-discover all joined servers
      log?.info("no servers configured — discovering joined servers");
      serverIds = await this.discoverJoinedServers();
      log?.info(`servers discovered — count: ${serverIds.length}, servers: ${serverIds.join(", ")}`);
    }

    if (serverIds.length === 0) {
      log?.info("no servers found — waiting for server join");
      this.activated = true;
      return;
    }

    // Subscribe to ALL channels in each server
    const resp = await this.qchat.server.subscribeAllChannel({
      sub_type: 1, // kNIMQChatSubscribeTypeMsg
      server_ids: serverIds,
    });

    if (resp.failed_servers && resp.failed_servers.length > 0) {
      log?.error(`subscribe failed — servers: ${resp.failed_servers.join(", ")}`);
    }

    this.subscribedServerIds = serverIds.filter(
      (id) => !(resp.failed_servers ?? []).includes(id),
    );
    log?.info(`subscribed to all channels — servers: ${this.subscribedServerIds.length}`);
    this.activated = true;
  }

  /**
   * Legacy one-shot start (calls both phases sequentially).
   * Prefer initListeners() + activate() for proper lifecycle control.
   */
  async start(): Promise<void> {
    this.initListeners();
    await this.activate();
  }

  /**
   * Auto-discover joined servers by paginating through getServersByPage.
   */
  private async discoverJoinedServers(): Promise<string[]> {
    const serverIds: string[] = [];
    let timestamp = 0;
    const PAGE_LIMIT = 100;

    for (let page = 0; page < 20; page++) {
      const resp = await this.qchat.server.getServersByPage({
        timestamp,
        limit: PAGE_LIMIT,
      });

      const servers = resp.server_list ?? [];
      if (servers.length === 0) break;

      for (const s of servers) {
        if (s.server_id) {
          serverIds.push(s.server_id);
        }
      }

      // If fewer results than limit, we've reached the end
      if (servers.length < PAGE_LIMIT) break;

      // Use the last server's create_time as cursor for next page
      const lastServer = servers[servers.length - 1];
      if (lastServer.create_time) {
        timestamp = lastServer.create_time;
      } else {
        break;
      }
    }

    return serverIds;
  }

  /**
   * Subscribe to all channels in a single server.
   * Used for dynamic subscription when the bot is invited to a new server.
   */
  private async subscribeServer(serverId: string): Promise<void> {
    const log = this.opts.log;

    const resp = await this.qchat.server.subscribeAllChannel({
      sub_type: 1, // kNIMQChatSubscribeTypeMsg
      server_ids: [serverId],
    });

    const failed = resp.failed_servers ?? [];
    if (failed.includes(serverId)) {
      log?.error(`[sysnotify] subscribe failed — server: ${serverId}`);
      return;
    }

    this.subscribedServerIds.push(serverId);
    log?.info(`[sysnotify] subscribed — server: ${serverId}, total servers: ${this.subscribedServerIds.length}`);
  }

  async sendText(params: {
    serverId: string;
    channelId: string;
    text: string;
  }): Promise<{ ok: boolean; msgServerId?: string; error?: string }> {
    try {
      const resp = await this.qchat.message.send({
        message: {
          server_id: params.serverId,
          channel_id: params.channelId,
          msg_type: 0, // text
          msg_body: params.text,
          resend_flag: false,
          history_enable: true,
        },
      });
      if (resp.res_code !== undefined && resp.res_code !== 200) {
        return { ok: false, error: `send failed: code=${resp.res_code}` };
      }
      return {
        ok: true,
        msgServerId: resp.message?.msg_server_id ?? undefined,
      };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async stop(): Promise<void> {
    if (!this.activated) return;

    // Unsubscribe all servers
    if (this.subscribedServerIds.length > 0) {
      try {
        await this.qchat.server.subscribeAllChannel({
          sub_type: 1,
          server_ids: [], // empty = unsubscribe all
        });
      } catch {
        // ignore unsubscribe errors during shutdown
      }
    }

    this.activated = false;
  }
}
