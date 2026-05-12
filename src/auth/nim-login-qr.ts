import { randomUUID } from "node:crypto";

import type { OpenClawConfig } from "openclaw/plugin-sdk/core";

import type { NimQrLoginConfig } from "../config-schema.js";
import { createNimUserViaServerApi } from "./nim-netease-create.js";
import { buildNimGatewayQrDataUrl, composeNimTokenLine } from "./nim-qrcode.js";

const ACTIVE_LOGIN_TTL_MS = 5 * 60_000;

/** 网关 nim-web.login.* / Flutter「/nim-login」解析用的扫码绑定配置（网易云信 REST，非微信 ilink）。 */
export type NimQrResolved = Pick<
  NimQrLoginConfig,
  "appKey" | "appSecret" | "nimApiHost" | "nimServerFlavor"
> & {
  writeToAccountKey: string;
};

type ActiveLogin = {
  sessionKey: string;
  id: string;
  startedAt: number;
  appKey: string;
  account: string;
  token: string;
  qrDataUrl: string;
};

const activeLogins = new Map<string, ActiveLogin>();

/** accid：网易云信限制字母数字下划线，最长 32 */
function randomAccid(): string {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 22);
  const id = `ocbot_${suffix}`;
  return id.length <= 32 ? id : id.slice(0, 32);
}

/** token ≤128 */
function randomInitialToken(): string {
  const a = randomUUID().replace(/-/g, "");
  const b = randomUUID().replace(/-/g, "");
  const t = `${a}${b}`.slice(0, 128);
  return t;
}

export function resolveNimQrLoginFromConfig(cfg: OpenClawConfig): NimQrResolved | null {
  const nim = cfg.channels?.nim as { qrLogin?: NimQrLoginConfig } | undefined;
  const q = nim?.qrLogin;
  const appKey = q?.appKey?.trim();
  const appSecret = q?.appSecret?.trim();
  if (!appKey || !appSecret) {
    return null;
  }
  return {
    appKey,
    appSecret,
    nimApiHost: q?.nimApiHost?.trim(),
    nimServerFlavor: q?.nimServerFlavor === "nim-legacy" ? "nim-legacy" : "im-v10",
    writeToAccountKey: q?.writeToAccountKey?.trim() || "primary",
  };
}

function isLoginFresh(login: ActiveLogin): boolean {
  return Date.now() - login.startedAt < ACTIVE_LOGIN_TTL_MS;
}

function purgeExpiredLogins(): void {
  for (const [k, login] of activeLogins) {
    if (!isLoginFresh(login)) {
      activeLogins.delete(k);
    }
  }
}

export type NimQrStartResult = {
  qrDataUrl?: string;
  message: string;
  sessionKey: string;
  connected?: boolean;
};

export type NimQrWaitResult = {
  connected: boolean;
  botToken?: string;
  nimAccount?: string;
  message: string;
};

export async function startNimLoginWithQr(params: {
  cfg: OpenClawConfig;
  accountId?: string;
  force?: boolean;
  verbose?: boolean;
}): Promise<NimQrStartResult> {
  const qrCfg = resolveNimQrLoginFromConfig(params.cfg);
  const sessionKey = params.accountId || randomUUID();

  if (!qrCfg) {
    return {
      message:
        "未配置 NIM 网关新账号绑定：请在 channels.nim.qrLogin 设置 appKey、appSecret（网易云信控制台，用于服务端注册 IM 账号）。不使用微信 ilink。",
      sessionKey,
    };
  }

  purgeExpiredLogins();

  const existing = activeLogins.get(sessionKey);
  if (
    !params.force &&
    existing &&
    isLoginFresh(existing) &&
    existing.appKey === qrCfg.appKey &&
    existing.qrDataUrl
  ) {
    return {
      qrDataUrl: existing.qrDataUrl,
      message:
        "凭据二维码仍在有效期内：扫码可读 nimToken；执行 nim-web.login.wait 将把账号写入 channels.nim.accounts。",
      sessionKey,
    };
  }

  try {
    const accountRequested = randomAccid();
    const initialToken = randomInitialToken();
    const { accountId, token } = await createNimUserViaServerApi({
      nimApiHost: qrCfg.nimApiHost,
      nimServerFlavor: qrCfg.nimServerFlavor,
      appKey: qrCfg.appKey,
      appSecret: qrCfg.appSecret,
      accountId: accountRequested,
      name: `OpenClaw bot ${accountRequested}`,
      token: initialToken,
    });

    const nimTokenLine = composeNimTokenLine(qrCfg.appKey, accountId, token);
    const qrDataUrl = await buildNimGatewayQrDataUrl(nimTokenLine);

    activeLogins.set(sessionKey, {
      sessionKey,
      id: randomUUID(),
      startedAt: Date.now(),
      appKey: qrCfg.appKey,
      account: accountId,
      token,
      qrDataUrl,
    });

    return {
      qrDataUrl,
      message:
        "已通过网易云信服务端注册新 IM 账号（默认 IM V10）。请调用 nim-web.login.wait 写入配置；二维码内容为 nimToken，可供手机扫码备份。",
      sessionKey,
    };
  } catch (err) {
    return {
      message: `发起 NIM 新账号绑定失败：${String(err)}`,
      sessionKey,
    };
  }
}

export async function waitForNimLogin(params: {
  cfg: OpenClawConfig;
  sessionKey: string;
  timeoutMs?: number;
  verbose?: boolean;
}): Promise<NimQrWaitResult> {
  const qrCfg = resolveNimQrLoginFromConfig(params.cfg);
  const login = activeLogins.get(params.sessionKey);

  if (!qrCfg) {
    return {
      connected: false,
      message: "未配置 channels.nim.qrLogin（appKey/appSecret），无法完成绑定。",
    };
  }

  if (!login) {
    return {
      connected: false,
      message: "当前没有进行中的会话，请先调用 nim-web.login.start（Flutter：/nim-login new）。",
    };
  }

  if (!isLoginFresh(login)) {
    activeLogins.delete(params.sessionKey);
    return { connected: false, message: "会话已过期，请重新 nim-web.login.start。" };
  }

  if (login.appKey !== qrCfg.appKey) {
    return { connected: false, message: "qrLogin.appKey 与会话不匹配，请重新 start。" };
  }

  activeLogins.delete(params.sessionKey);
  return {
    connected: true,
    botToken: login.token,
    nimAccount: login.account,
    message: "NIM 新账号凭据已就绪，正在写入 channels.nim.accounts。",
  };
}
