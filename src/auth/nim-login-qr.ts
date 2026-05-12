import { randomUUID } from "node:crypto";

import type { OpenClawConfig } from "openclaw/plugin-sdk/core";

import type { NimQrLoginConfig } from "../config-schema.js";
import {
  buildNimLbsQrPayload,
  DEFAULT_NIM_LBS_BASE_URL,
  nimLbsGetQrCode,
  nimLbsWaitForBinding,
} from "./nim-lbs-bind.js";
import { buildNimGatewayQrDataUrl } from "./nim-qrcode.js";

/**
 * 网关扫码绑定用的网易云信 **应用级**密钥（可选：仅在使用服务端 REST 建号等扩展场景时需要）。
 * 与 `test/send-test.ts` 一致的可通过环境变量注入。
 */
export const NIM_QR_LOGIN_ENV_APP_KEY = "NIM_APP_KEY";
export const NIM_QR_LOGIN_ENV_APP_SECRET = "NIM_APP_SECRET";
/** 可选；等价于 `qrLogin.nimApiHost` */
export const NIM_QR_LOGIN_ENV_NIM_API_HOST = "NIM_QR_LOGIN_NIM_API_HOST";
/** 覆盖默认 `https://lbs.netease.im`（与 openclaw-nim-tools 一致） */
export const NIM_LBS_BASE_URL_ENV = "NIM_LBS_BASE_URL";

/** 网关 nim-web.login.*：`resolveNimQrLoginFromConfig` 解析的 REST 侧字段（可选）。 */
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
  qrDataUrl: string;
  lbsBaseUrl: string;
  qrCode: string;
  expireAt: number;
};

const activeLogins = new Map<string, ActiveLogin>();

/** LBS 扫码写入位置与可选 LBS 根地址（无需 AppKey/AppSecret）。 */
export function resolveNimGatewayQrBindOptions(cfg: OpenClawConfig): {
  writeToAccountKey: string;
  lbsBaseUrl: string;
} {
  const nim = cfg.channels?.nim as { qrLogin?: NimQrLoginConfig } | undefined;
  const q = nim?.qrLogin;
  const raw =
    q?.lbsBaseUrl?.trim() || process.env[NIM_LBS_BASE_URL_ENV]?.trim() || DEFAULT_NIM_LBS_BASE_URL;
  return {
    lbsBaseUrl: raw.replace(/\/+$/, ""),
    writeToAccountKey: q?.writeToAccountKey?.trim() || "primary",
  };
}

export function resolveNimQrLoginFromConfig(cfg: OpenClawConfig): NimQrResolved | null {
  const nim = cfg.channels?.nim as { qrLogin?: NimQrLoginConfig } | undefined;
  const q = nim?.qrLogin;
  const appKey = (q?.appKey?.trim() || process.env[NIM_QR_LOGIN_ENV_APP_KEY]?.trim() || "").trim();
  const appSecret = (
    q?.appSecret?.trim() ||
    process.env[NIM_QR_LOGIN_ENV_APP_SECRET]?.trim() ||
    ""
  ).trim();
  if (!appKey || !appSecret) {
    return null;
  }
  const nimApiHostRaw =
    (q?.nimApiHost?.trim() || process.env[NIM_QR_LOGIN_ENV_NIM_API_HOST]?.trim() || "").trim();
  return {
    appKey,
    appSecret,
    nimApiHost: nimApiHostRaw || undefined,
    nimServerFlavor: q?.nimServerFlavor === "nim-legacy" ? "nim-legacy" : "im-v10",
    writeToAccountKey: q?.writeToAccountKey?.trim() || "primary",
  };
}

function isLbsSessionValid(login: ActiveLogin): boolean {
  return Date.now() < login.expireAt - 500;
}

function purgeExpiredLogins(): void {
  for (const [k, login] of activeLogins) {
    if (!isLbsSessionValid(login)) {
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
  /** LBS 绑定完成后由云端返回，用于写入 nimToken */
  nimAppKey?: string;
  message: string;
};

export async function startNimLoginWithQr(params: {
  cfg: OpenClawConfig;
  accountId?: string;
  force?: boolean;
  verbose?: boolean;
}): Promise<NimQrStartResult> {
  const bindOpts = resolveNimGatewayQrBindOptions(params.cfg);
  const sessionKey = params.accountId || randomUUID();

  purgeExpiredLogins();

  const existing = activeLogins.get(sessionKey);
  if (
    !params.force &&
    existing &&
    isLbsSessionValid(existing) &&
    existing.qrDataUrl &&
    existing.lbsBaseUrl === bindOpts.lbsBaseUrl
  ) {
    return {
      qrDataUrl: existing.qrDataUrl,
      message:
        "扫码会话仍有效：请用网易云信客户端扫描；完成后调用 nim-web.login.wait 写入 channels.nim.accounts。",
      sessionKey,
    };
  }

  try {
    const { qrCode, expireAt } = await nimLbsGetQrCode(bindOpts.lbsBaseUrl, { timeoutMs: 15_000 });
    const payload = buildNimLbsQrPayload(qrCode, expireAt);
    const qrDataUrl = await buildNimGatewayQrDataUrl(payload);

    activeLogins.set(sessionKey, {
      sessionKey,
      id: randomUUID(),
      startedAt: Date.now(),
      qrDataUrl,
      lbsBaseUrl: bindOpts.lbsBaseUrl,
      qrCode,
      expireAt,
    });

    return {
      qrDataUrl,
      message:
        "已获取网易云信 LBS 扫码会话（与 openclaw-nim-tools install 同源）。请用 NIM 客户端扫码绑定 AI 账号；完成后调用 nim-web.login.wait。",
      sessionKey,
    };
  } catch (err) {
    return {
      message: `发起 NIM LBS 扫码绑定失败：${String(err)}`,
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
  const bindOpts = resolveNimGatewayQrBindOptions(params.cfg);
  const login = activeLogins.get(params.sessionKey);

  if (!login) {
    return {
      connected: false,
      message: "当前没有进行中的会话，请先调用 nim-web.login.start（Flutter：/nim-login new）。",
    };
  }

  if (!isLbsSessionValid(login)) {
    activeLogins.delete(params.sessionKey);
    return { connected: false, message: "扫码会话已过期，请重新 nim-web.login.start。" };
  }

  if (login.lbsBaseUrl !== bindOpts.lbsBaseUrl) {
    return {
      connected: false,
      message: "当前会话的 LBS 根地址与配置不一致，请重新 start。",
    };
  }

  const remaining = Math.max(1000, login.expireAt - Date.now());
  const cap = params.timeoutMs ?? 180_000;
  const pollTimeout = Math.min(remaining, cap);

  try {
    const bound = await nimLbsWaitForBinding(login.lbsBaseUrl, login.qrCode, {
      pollIntervalMs: 3000,
      timeoutMs: pollTimeout,
    });
    activeLogins.delete(params.sessionKey);
    return {
      connected: true,
      botToken: bound.token,
      nimAccount: bound.account,
      nimAppKey: bound.appKey,
      message: "NIM LBS 扫码绑定成功，正在写入 channels.nim.accounts。",
    };
  } catch (err) {
    return {
      connected: false,
      message: String(err),
    };
  }
}
