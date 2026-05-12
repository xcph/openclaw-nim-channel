import { createHash, randomBytes } from "node:crypto";

/** IM V10 国内主域：https://doc.commsease.com/messaging2/server-apis/zcwODA3MTU */
export const DEFAULT_NIM_OPEN_HOST = "https://open.yunxinapi.com";

/** 旧版 nimserver 表单接口常用根域（仅 nim-legacy 模式） */
export const DEFAULT_NIM_LEGACY_HOST = "https://api.netease.im";

export type NimServerFlavor = "im-v10" | "nim-legacy";

function buildChecksum(appSecret: string, nonce: string, curTime: string): string {
  return createHash("sha1").update(`${appSecret}${nonce}${curTime}`, "utf8").digest("hex");
}

function pickMsg(root: Record<string, unknown>): string {
  if (typeof root.msg === "string" && root.msg.trim()) return root.msg.trim();
  if (typeof root.desc === "string" && root.desc.trim()) return root.desc.trim();
  return JSON.stringify(root).slice(0, 400);
}

function parseLegacyInfoToken(info: unknown, fallbackToken: string): string {
  if (info && typeof info === "object" && !Array.isArray(info)) {
    const o = info as Record<string, unknown>;
    const t = o.token;
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  if (typeof info === "string" && info.trim()) {
    try {
      const inner = JSON.parse(info) as unknown;
      if (inner && typeof inner === "object" && !Array.isArray(inner)) {
        const t = (inner as Record<string, unknown>).token;
        if (typeof t === "string" && t.trim()) return t.trim();
      }
    } catch {
      /* ignore */
    }
  }
  return fallbackToken.trim();
}

export type CreateNimUserParams = {
  /**
   * REST 根地址，勿带尾部路径。
   * - im-v10：默认 `https://open.yunxinapi.com`，备用 `https://open-bak.yunxinapi.com`
   * - nim-legacy：默认 `https://api.netease.im`
   */
  nimApiHost?: string;
  nimServerFlavor?: NimServerFlavor;
  appKey: string;
  appSecret: string;
  accountId: string;
  /** user_information.name / 旧接口 name */
  name?: string;
  /** 登录密钥；建议传入随机串（≤128） */
  token?: string;
};

export type CreateNimUserResult = {
  /** 以服务端返回为准（V10 为 data.account_id）；legacy 为请求值规范化后 */
  accountId: string;
  token: string;
};

function hint414(flavor: NimServerFlavor): string {
  if (flavor === "im-v10") {
    return "（414：多为 CheckSum 失败，或域名/接口版本不匹配。请确认使用 IM **V10** 域名 **open.yunxinapi.com** 与路径 **/im/v2/accounts**，不要在 open 域上调用 nimserver。另核对 AppSecret 与 App Key 同属一应用、复制无多余空白；容器 NTP 与时间差须小于 5 分钟。备用域：open-bak.yunxinapi.com。）";
  }
  return "（414：多为 CheckSum 失败。请核对 AppSecret、NTP；legacy 模式确认 nimApiHost 与 nimserver 路由可达。）";
}

async function createImV10Accounts(params: CreateNimUserParams): Promise<CreateNimUserResult> {
  const host = (params.nimApiHost?.trim() || DEFAULT_NIM_OPEN_HOST).replace(/\/+$/, "");
  const url = `${host}/im/v2/accounts`;
  const nonce = randomBytes(16).toString("hex");
  const curTime = String(Math.floor(Date.now() / 1000));
  const checkSum = buildChecksum(params.appSecret.trim(), nonce, curTime);

  const payload: Record<string, unknown> = {
    account_id: params.accountId.trim(),
    user_information: {
      name: (params.name ?? params.accountId).trim(),
    },
  };
  if (params.token?.trim()) {
    payload.token = params.token.trim();
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      AppKey: params.appKey.trim(),
      Nonce: nonce,
      CurTime: curTime,
      CheckSum: checkSum,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`网易云信 IM V10 注册账号返回非 JSON（HTTP ${res.status}）：${text.slice(0, 280)}`);
  }

  const root = parsed as Record<string, unknown>;
  const codeRaw = root.code;
  const code = typeof codeRaw === "number" ? codeRaw : Number(codeRaw);
  if (!Number.isFinite(code) || code !== 200) {
    const msg = pickMsg(root);
    const hint = code === 414 ? hint414("im-v10") : "";
    throw new Error(`网易云信 IM V10 注册账号失败：code=${String(codeRaw)} ${msg}${hint}`);
  }

  const data = root.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`网易云信 IM V10 成功响应缺少 data：${text.slice(0, 320)}`);
  }
  const d = data as Record<string, unknown>;
  const accountId = typeof d.account_id === "string" ? d.account_id.trim() : "";
  const token =
    typeof d.token === "string" && d.token.trim()
      ? d.token.trim()
      : params.token?.trim() ?? "";
  if (!accountId || !token) {
    throw new Error(`网易云信 IM V10 响应缺少 account_id/token：${text.slice(0, 320)}`);
  }

  return { accountId, token };
}

async function createNimLegacyForm(params: CreateNimUserParams): Promise<CreateNimUserResult> {
  const host = (params.nimApiHost?.trim() || DEFAULT_NIM_LEGACY_HOST).replace(/\/+$/, "");
  const url = `${host}/nimserver/user/create.action`;
  const nonce = randomBytes(16).toString("hex");
  const curTime = String(Math.floor(Date.now() / 1000));
  const checkSum = buildChecksum(params.appSecret.trim(), nonce, curTime);

  const body = new URLSearchParams();
  body.set("accid", params.accountId.trim());
  body.set("name", (params.name ?? params.accountId).trim());
  if (params.token?.trim()) {
    body.set("token", params.token.trim());
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      AppKey: params.appKey.trim(),
      Nonce: nonce,
      CurTime: curTime,
      CheckSum: checkSum,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: body.toString(),
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`网易云信 nimserver user/create 返回非 JSON（HTTP ${res.status}）：${text.slice(0, 280)}`);
  }

  const root = parsed as Record<string, unknown>;
  const codeRaw = root.code;
  const code = typeof codeRaw === "number" ? codeRaw : Number(codeRaw);
  if (!Number.isFinite(code) || code !== 200) {
    const msg = pickMsg(root);
    const hint = code === 414 ? hint414("nim-legacy") : "";
    throw new Error(`网易云信 nimserver user/create 失败：code=${String(codeRaw)} ${msg}${hint}`);
  }

  const tok = parseLegacyInfoToken(root.info, params.token ?? "");
  if (!tok) {
    throw new Error(`网易云信 nimserver 成功但未解析到 token：${text.slice(0, 320)}`);
  }

  return { accountId: params.accountId.trim(), token: tok };
}

/**
 * 网易云信：创建 IM 账号。
 * - **im-v10**（默认）：`POST {host}/im/v2/accounts`，JSON，域名一般为 **open.yunxinapi.com**
 * - **nim-legacy**：`POST {host}/nimserver/user/create.action`，表单（旧栈 / 专有云）
 *
 * @see https://doc.commsease.com/messaging2/server-apis/TQyNjgyMzc
 */
export async function createNimUserViaServerApi(params: CreateNimUserParams): Promise<CreateNimUserResult> {
  const flavor: NimServerFlavor = params.nimServerFlavor ?? "im-v10";
  if (flavor === "nim-legacy") {
    return createNimLegacyForm(params);
  }
  return createImV10Accounts(params);
}
