import { createHash, randomBytes } from "node:crypto";

/** 默认与网易云信服务端 API 文档一致；专有云可改 qrLogin.nimApiHost。 */
export const DEFAULT_NIM_API_HOST = "https://api.netease.im";

function buildChecksum(appSecret: string, nonce: string, curTime: string): string {
  return createHash("sha1").update(appSecret + nonce + curTime).digest("hex");
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
  /** 如 `https://api.netease.im`，勿带尾部路径 */
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
    throw new Error(`网易云信 user/create 失败：code=${String(codeRaw)} ${desc}`);
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
