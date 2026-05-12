/**
 * 网易云信 LBS「扫码绑定 AI 账号」——与 @nimsuite/openclaw-nim-tools 同源路径（lbs.netease.im）。
 *
 * @see openclaw-nim-tools dist/utils/nim-qr.js
 */

export const DEFAULT_NIM_LBS_BASE_URL = "https://lbs.netease.im";

const DEFAULT_USER_AGENT = "YUNXIN-AI-BOT-SDK";

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = String(baseUrl || "").trim();
  if (!trimmed) {
    throw new Error("LBS base URL 不能为空。");
  }
  return trimmed.replace(/\/+$/, "");
}

type LbsEnvelope<T = unknown> = {
  code?: number;
  msg?: string;
  data?: T;
};

async function lbsRequestJson<T>(
  url: string,
  body: Record<string, unknown> | null,
  options: { timeoutMs?: number } = {},
): Promise<LbsEnvelope<T>> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: body === null ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": DEFAULT_USER_AGENT,
      },
      body: body === null ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    try {
      return JSON.parse(text) as LbsEnvelope<T>;
    } catch {
      throw new Error(`LBS 返回非 JSON（HTTP ${response.status}）：${text.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

/** 申请扫码会话 UUID（无需事先配置 AppKey/AppSecret）。 */
export async function nimLbsGetQrCode(
  baseUrl: string,
  options: { timeoutMs?: number } = {},
): Promise<{ qrCode: string; expireAt: number }> {
  const url = `${normalizeBaseUrl(baseUrl)}/lbs/getQrCode`;
  const result = await lbsRequestJson<{ qrCode?: string; expireAt?: number }>(url, {}, options);
  const qrCode = result?.data?.qrCode;
  const expireAt = Number(result?.data?.expireAt ?? 0);
  if (result?.code !== 200 || !qrCode || !expireAt) {
    throw new Error(result?.msg || "LBS getQrCode 失败：未返回有效 qrCode / expireAt。");
  }
  return { qrCode: String(qrCode), expireAt };
}

export type NimLbsBindResult = {
  appKey: string;
  account: string;
  token: string;
};

/** 查询扫码绑定是否已完成（未完成返回 null）。 */
export async function nimLbsQueryBindAiAccountByQrCode(
  baseUrl: string,
  qrCodeUuid: string,
  options: { timeoutMs?: number } = {},
): Promise<NimLbsBindResult | null> {
  const encoded = encodeURIComponent(String(qrCodeUuid));
  const url = `${normalizeBaseUrl(baseUrl)}/lbs/queryBindAiAccountByQrCode?qrCode=${encoded}`;
  const result = await lbsRequestJson<
    string | { appkey?: string; accid?: string; token?: string; ownerAccid?: string }
  >(url, null, options);

  if (result?.code === 404 && String(result?.msg || "").toLowerCase() === "not found") {
    return null;
  }
  if (result?.code !== 200) {
    throw new Error(result?.msg || "LBS queryBindAiAccountByQrCode 请求失败。");
  }
  const data = result.data;
  if (data === "invalid user-agent") {
    throw new Error("LBS 拒绝请求：User-Agent 无效。");
  }
  if (data === "not found") {
    return null;
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const appKey = String((data as { appkey?: string }).appkey || "").trim();
    const account = String((data as { accid?: string }).accid || "").trim();
    const token = String((data as { token?: string }).token || "").trim();
    if (appKey && account && token) {
      return { appKey, account, token };
    }
  }
  throw new Error("LBS 绑定响应缺少 appkey、accid 或 token。");
}

/** 轮询直到绑定成功或超时（与 nim-tools install 行为一致）。 */
export async function nimLbsWaitForBinding(
  baseUrl: string,
  qrCodeUuid: string,
  options: { pollIntervalMs?: number; timeoutMs: number },
): Promise<NimLbsBindResult> {
  const pollIntervalMs = Number(options.pollIntervalMs ?? 3000);
  const timeoutMs = Number(options.timeoutMs);
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const row = await nimLbsQueryBindAiAccountByQrCode(baseUrl, qrCodeUuid, {
      timeoutMs: Math.min(15_000, Math.max(3000, timeoutMs - (Date.now() - startedAt))),
    });
    if (row) {
      return row;
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  throw new Error(`LBS 扫码绑定超时（${timeoutMs}ms）。请重新 nim-web.login.start。`);
}

/** `openclaw-nim-tools` / 移动端扫码载荷（JSON 字符串嵌入二维码）。 */
export function buildNimLbsQrPayload(qrCode: string, expireAt: number): string {
  return JSON.stringify({ qrCode, expireAt });
}
