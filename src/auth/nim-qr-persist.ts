import type { OpenClawConfig } from "openclaw/plugin-sdk/core";

import { resolveNimGatewayQrBindOptions } from "./nim-login-qr.js";

export async function persistNimQrCredentials(params: {
  writeToAccountKey: string;
  appKey: string;
  account: string;
  token: string;
}): Promise<void> {
  const { loadConfig, writeConfigFile } = await import("openclaw/plugin-sdk/config-runtime");
  const cfg = loadConfig();
  const nimRaw = cfg.channels?.nim as Record<string, unknown> | undefined;
  const nimCfg = { ...(nimRaw ?? {}) };
  const accounts = {
    ...((nimCfg.accounts as Record<string, unknown> | undefined) ?? {}),
  };
  const prev = (accounts[params.writeToAccountKey] as Record<string, unknown>) ?? {};
  accounts[params.writeToAccountKey] = {
    ...prev,
    enabled: true,
    nimToken: `${params.appKey}|${params.account}|${params.token}`,
  };
  nimCfg.accounts = accounts;
  await writeConfigFile({
    ...cfg,
    channels: {
      ...cfg.channels,
      nim: nimCfg,
    },
  } as OpenClawConfig);
}

export function resolveNimQrWriteAccountKey(params: {
  cfg: OpenClawConfig;
  gatewayAccountId?: string | null;
}): string {
  const g = params.gatewayAccountId?.trim();
  if (g) return g;
  const opts = resolveNimGatewayQrBindOptions(params.cfg);
  return opts.writeToAccountKey;
}
