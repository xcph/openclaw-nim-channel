import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

import { nimPlugin } from "./channel.js";

type NimChannelPlugin = typeof nimPlugin;

type GatewayHandler = (ctx: {
  params: Record<string, unknown>;
  respond: (
    ok: boolean,
    payload?: unknown,
    error?: { code?: string; message: string },
  ) => void;
}) => void | Promise<void>;

export function registerNimQrGatewayMethods(
  api: OpenClawPluginApi,
  channel: NimChannelPlugin,
): void {
  const register = (
    api as OpenClawPluginApi & {
      registerGatewayMethod?: (method: string, handler: GatewayHandler) => void;
    }
  ).registerGatewayMethod;
  const gw = channel.gateway;
  if (!register || !gw?.loginWithQrStart || !gw?.loginWithQrWait) {
    return;
  }

  register.call(api, "nim-web.login.start", async ({ params, respond }) => {
    try {
      const result = await gw.loginWithQrStart({
        accountId:
          typeof params.accountId === "string" ? params.accountId : undefined,
        force: params.force === true,
        timeoutMs:
          typeof params.timeoutMs === "number" ? params.timeoutMs : undefined,
        verbose: params.verbose === true,
      });
      respond(true, result);
    } catch (err) {
      respond(false, undefined, {
        code: "UNAVAILABLE",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  register.call(api, "nim-web.login.wait", async ({ params, respond }) => {
    try {
      const result = await gw.loginWithQrWait({
        accountId:
          typeof params.accountId === "string" ? params.accountId : undefined,
        timeoutMs:
          typeof params.timeoutMs === "number" ? params.timeoutMs : undefined,
        sessionKey:
          typeof params.sessionKey === "string" ? params.sessionKey : undefined,
        currentQrDataUrl:
          typeof params.currentQrDataUrl === "string"
            ? params.currentQrDataUrl
            : undefined,
      });
      respond(true, result);
    } catch (err) {
      respond(false, undefined, {
        code: "UNAVAILABLE",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
