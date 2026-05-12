/**
 * 网易云信「网关扫码登录」二维码：`nim-web.login.start` 返回给 Flutter 的 `qrDataUrl`。
 *
 * 与 @nimsuite/openclaw-nim-channel 行为对齐：服务端生成 **nimToken** 文本（`appKey|accountId|token`），
 * 再由 `qrcode` 渲染为 **PNG data URL**，供 `_OpenclawWeixinLoginDialog`（data:image 分支）展示。
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

/** 将凭据文本编码为 `data:image/png;base64,...`，用作网关 `payload.qrDataUrl`。 */
export async function buildNimGatewayQrDataUrl(nimTokenLine: string): Promise<string> {
  const line = nimTokenLine.trim();
  if (!line) {
    throw new Error("nimTokenLine 为空，无法生成二维码");
  }
  return QRCode.toDataURL(line, NIM_GATEWAY_QR_TO_DATA_URL_OPTIONS);
}
