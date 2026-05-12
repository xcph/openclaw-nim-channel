import { createHash, randomBytes } from "node:crypto";

/** IM V10 国内主域：https://doc.commsease.com/messaging2/server-apis/zcwODA3MTU */
export const DEFAULT_NIM_OPEN_HOST = "https://open.yunxinapi.com";

/** IM V10 新加坡等海外数据中心 open 网关 */
export const DEFAULT_NIM_OPEN_HOST_SG = "https://open-sg.yunxinapi.com";

/** 旧版 nimserver 表单接口常用根域（仅 nim-legacy 模式） */
export const DEFAULT_NIM_LEGACY_HOST = "https://api.netease.im";

export type NimServerFlavor = "im-v10" | "nim-legacy";

export type CreateNimUserParams = {
  /**
   * REST 根地址，勿带尾部路径。
   * - im-v10：默认 `https://open.yunxinapi.com`；若 **未配置** 本字段且注册返回 **101303**，会在国内 open 与 `https://open-sg.yunxinapi.com` 之间自动再试一次。亦可手动指定数据中心域名。
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

function buildChecksum(appSecret: string, nonce: string, curTime: string): string {
  return createHash("sha1").update(`${appSecret}${nonce}${curTime}`, "utf8").digest("hex");
}

function pickMsg(root: Record<string, unknown>): string {
  if (typeof root.msg === "string" && root.msg.trim()) return root.msg.trim();
  if (typeof root.desc === "string" && root.desc.trim()) return root.desc.trim();
  return JSON.stringify(root).slice(0, 400);
}

/** 去掉复制粘贴常见的 BOM / 零宽字符，避免 Header 里 Key 与控制台不一致 */
function stripCopyArtifacts(s: string): string {
  return s.replace(/\uFEFF/g, "").replace(/\u200b/g, "").trim();
}

function normalizeParams(params: CreateNimUserParams): CreateNimUserParams {
  return {
    ...params,
    nimApiHost: params.nimApiHost !== undefined ? stripCopyArtifacts(params.nimApiHost) : undefined,
    appKey: stripCopyArtifacts(params.appKey),
    appSecret: stripCopyArtifacts(params.appSecret),
    accountId: stripCopyArtifacts(params.accountId),
    name: params.name !== undefined ? stripCopyArtifacts(params.name) : undefined,
    token: params.token !== undefined ? stripCopyArtifacts(params.token) : undefined,
  };
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

function hint414(flavor: NimServerFlavor): string {
  if (flavor === "im-v10") {
    return "（414：多为 CheckSum 失败，或域名/接口版本不匹配。请确认使用 IM **V10** 域名 **open.yunxinapi.com** 与路径 **/im/v2/accounts**，不要在 open 域上调用 nimserver。另核对 AppSecret 与 App Key 同属一应用、复制无多余空白；容器 NTP 与时间差须小于 5 分钟。备用域：open-bak.yunxinapi.com。）";
  }
  return "（414：多为 CheckSum 失败。请核对 AppSecret、NTP；legacy 模式确认 nimApiHost 与 nimserver 路由可达。）";
}

function hintForKnownCodes(code: number, flavor: NimServerFlavor): string {
  if (code === 414) return hint414(flavor);
  if (code === 101303) {
    return "（101303：**服务端不认当前 App Key**。若 **未配置** qrLogin.nimApiHost，已自动依次请求国内 **open.yunxinapi.com** 与新加坡 **open-sg.yunxinapi.com**；仍失败请到控制台核对 **IM 即时通讯** 应用（勿用其它产品线密钥、勿保留占位符），Key 与 Secret 须同属一个应用。若控制台标明指定数据中心，也可 **手动设置** qrLogin.nimApiHost。）";
  }
  return "";
}

function coerceV10Host(host: string): string {
  const h = host.replace(/\/+$/, "");
  /** 旧文档「api.yunxinapi.com」为另一套接入；IM V10 账号接口在 open 网关 */
  if (/^https?:\/\/api\.yunxinapi\.com$/i.test(h)) {
    return DEFAULT_NIM_OPEN_HOST;
  }
  return h;
}

function normalizeGatewayHost(host: string): string {
  return host.replace(/\/+$/, "");
}

async function postImV2Accounts(
  params: CreateNimUserParams,
  hostBase: string,
): Promise<
  | { accountId: string; token: string }
  | { error: true; code: number; codeRaw: unknown; msg: string }
> {
  const host = normalizeGatewayHost(hostBase);
  const url = `${host}/im/v2/accounts`;
  const nonce = randomBytes(16).toString("hex");
  const curTime = String(Math.floor(Date.now() / 1000));
  const checkSum = buildChecksum(params.appSecret, nonce, curTime);

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
    return { error: true, code, codeRaw, msg: pickMsg(root) };
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

async function createImV10Accounts(params: CreateNimUserParams): Promise<CreateNimUserResult> {
  const explicitHost = Boolean(params.nimApiHost?.trim());
  const rawHost = (params.nimApiHost?.trim() || DEFAULT_NIM_OPEN_HOST).replace(/\/+$/, "");
  const primaryHost = normalizeGatewayHost(coerceV10Host(rawHost));

  const first = await postImV2Accounts(params, primaryHost);
  if (!("error" in first)) {
    return { accountId: first.accountId, token: first.token };
  }

  /** 未显式配置 nimApiHost 且遇到「该区域不认该 Key」时，国内 ⇄ 新加坡 open 网关各试一次 */
  if (!explicitHost && first.code === 101303) {
    const cn = normalizeGatewayHost(DEFAULT_NIM_OPEN_HOST).toLowerCase();
    const sg = normalizeGatewayHost(DEFAULT_NIM_OPEN_HOST_SG).toLowerCase();
    const cur = primaryHost.toLowerCase();
    const alt =
      cur === cn ? normalizeGatewayHost(DEFAULT_NIM_OPEN_HOST_SG) : cur === sg ? normalizeGatewayHost(DEFAULT_NIM_OPEN_HOST) : null;
    if (alt && alt.toLowerCase() !== cur) {
      const second = await postImV2Accounts(params, alt);
      if (!("error" in second)) {
        return { accountId: second.accountId, token: second.token };
      }
      throw new Error(
        `网易云信 IM V10 注册账号失败：已依次请求 ${primaryHost}（code=${first.code} ${first.msg}）与 ${alt}（code=${second.code} ${second.msg}）。${hintForKnownCodes(second.code, "im-v10")}`,
      );
    }
  }

  throw new Error(
    `网易云信 IM V10 注册账号失败：code=${String(first.codeRaw)} ${first.msg}${hintForKnownCodes(first.code, "im-v10")}`,
  );
}

async function createNimLegacyForm(params: CreateNimUserParams): Promise<CreateNimUserResult> {
  const host = (params.nimApiHost?.trim() || DEFAULT_NIM_LEGACY_HOST).replace(/\/+$/, "");
  const url = `${host}/nimserver/user/create.action`;
  const nonce = randomBytes(16).toString("hex");
  const curTime = String(Math.floor(Date.now() / 1000));
  const checkSum = buildChecksum(params.appSecret, nonce, curTime);

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
    const hint = hintForKnownCodes(code, "nim-legacy");
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
  const p = normalizeParams(params);
  if (!p.appKey || !p.appSecret) {
    throw new Error(
      "网易云信：channels.nim.qrLogin 中 appKey / appSecret 不能为空（请填入控制台真实密钥，勿保留 __REPLACE__ 等占位符）。",
    );
  }
  const flavor: NimServerFlavor = p.nimServerFlavor ?? "im-v10";
  if (flavor === "nim-legacy") {
    return createNimLegacyForm(p);
  }
  return createImV10Accounts(p);
}
