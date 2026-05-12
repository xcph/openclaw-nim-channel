import { createHash, randomBytes } from "node:crypto";

/** 国内主域名（文档 2025+）：https://doc.commsease.com/messaging2/server-apis/jk3MzY2MTI */
export const DEFAULT_NIM_API_HOST = "https://api.yunxinapi.com";

function buildChecksum(appSecret: string, nonce: string, curTime: string): string {
  return createHash("sha1").update(`${appSecret}${nonce}${curTime}`, "utf8").digest("hex");
}

function parseInfoRecord(info: unknown): Record<string, unknown> | null {
  if (info && typeof info === "object" && !Array.isArray(info)) {
    return info as Record<string, unknown>;
  }
  if (typeof info === "string" && info.trim()) {
    try {
      const inner = JSON.parse(info) as unknown;
      if (inner && typeof inner === "object" && !Array.isArray(inner)) {
        return inner as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export type CreateNimUserParams = {
  /** 如 `https://api.yunxinapi.com`，勿带尾部路径；专有云按控制台填写 */
  nimApiHost?: string;
  appKey: string;
  appSecret: string;
  accid: string;
  /** 资料名，控制台可见 */
  name?: string;
  /** 登录密钥，≤128；不传则由服务端生成（仍以响应为准） */
  token?: string;
};

export type CreateNimUserResult = {
  token: string;
};

/**
 * 网易云信服务端 API：创建 IM 账号。
 * @see https://doc.commsease.com/messaging2/server-apis/TQyNjgyMzc
 */
export async function createNimUserViaServerApi(params: CreateNimUserParams): Promise<CreateNimUserResult> {
  const host = (params.nimApiHost?.trim() || DEFAULT_NIM_API_HOST).replace(/\/+$/, "");
  const url = `${host}/nimserver/user/create.action`;
  const nonce = randomBytes(16).toString("hex");
  const curTime = String(Math.floor(Date.now() / 1000));
  const checkSum = buildChecksum(params.appSecret.trim(), nonce, curTime);

  const body = new URLSearchParams();
  body.set("accid", params.accid.trim());
  body.set("name", (params.name ?? params.accid).trim());
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
    throw new Error(`网易云信 user/create 返回非 JSON（HTTP ${res.status}）：${text.slice(0, 280)}`);
  }

  const root = parsed as Record<string, unknown>;
  const codeRaw = root.code;
  const code = typeof codeRaw === "number" ? codeRaw : Number(codeRaw);
  if (!Number.isFinite(code) || code !== 200) {
    const desc = typeof root.desc === "string" ? root.desc : JSON.stringify(parsed).slice(0, 400);
    const hint414 =
      code === 414
        ? "（414：CheckSum 校验失败。请核对控制台 App Secret 是否与当前 App Key 为同一应用、复制无首尾空格或换行；网关容器需 NTP 同步（与服务端时间差须在 5 分钟内）；国内请优先使用 api.yunxinapi.com，必要时可在 qrLogin.nimApiHost 填写备用域名 api-cn-bak.yunxinapi.com。）"
        : "";
    throw new Error(`网易云信 user/create 失败：code=${String(codeRaw)} ${desc}${hint414}`);
  }

  const infoRec = parseInfoRecord(root.info);
  const fromApi =
    infoRec && typeof infoRec.token === "string" && infoRec.token.trim() ? infoRec.token.trim() : "";
  const tok = params.token?.trim() || fromApi;
  if (!tok) {
    throw new Error(`网易云信 user/create 成功但未解析到 token：${text.slice(0, 320)}`);
  }

  return { token: tok };
}
