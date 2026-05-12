/**
 * 网易云信「网关扫码登录」二维码：`nim-web.login.start` 返回给 Flutter 的 `qrDataUrl`。
 *
 * **LBS 绑定**（默认）：载荷为 JSON `{"qrCode":"<uuid>","expireAt":<ms>}`，与 openclaw-nim-tools / NIM 客户端约定一致。
 * **PNG**：由 `qrcode` 渲染，供 `_OpenclawWeixinLoginDialog`（data:image 分支）展示。
 */
import QRCode from "qrcode";

/** OpenClaw 网关对话框预览尺寸（与 Flutter `_OpenclawWeixinQrImageHeight` 比例友好） */
export const NIM_GATEWAY_QR_TO_DATA_URL_OPTIONS: QRCode.QRCodeToDataURLOptions = {
  errorCorrectionLevel: "M",
  margin: 2,
  width: 280,
  type: "image/png",
};

/** NIM `nimToken` 单行写法（SDK / channels.accounts.nimToken 同款）。 */
export function composeNimTokenLine(appKey: string, accountId: string, token: string): string {
  return `${appKey.trim()}|${accountId.trim()}|${token.trim()}`;
}

/** 将扫码载荷文本编码为 `data:image/png;base64,...`（LBS JSON 或 nimToken 单行）。 */
export async function buildNimGatewayQrDataUrl(payloadText: string): Promise<string> {
  const line = payloadText.trim();
  if (!line) {
    throw new Error("二维码载荷为空");
  }
  return QRCode.toDataURL(line, NIM_GATEWAY_QR_TO_DATA_URL_OPTIONS);
}
