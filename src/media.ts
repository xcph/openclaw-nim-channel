/**
 * NIM Media - 媒体消息处理模块 (node-nim 版本)
 */

import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type { NimConfig, NimSendResult, NimMediaInfo, NimMessageEvent, NimSessionType } from "./types.js";
import { createNimClient, getCachedNimClient } from "./client.js";
import { normalizeNimTarget } from "./targets.js";
import { getNimRuntime } from "./runtime.js";
import { extname, join } from "path";
import * as os from "os";
import * as fs from "fs";
import * as https from "https";
import * as http from "http";

/**
 * 发送图片消息
 */
export async function sendImageNim(params: {
  cfg: OpenClawConfig;
  to: string;
  imagePath: string;
  sessionType?: NimSessionType;
}): Promise<NimSendResult> {
  const { cfg, to, imagePath, sessionType = "p2p" } = params;
  const nimCfg = cfg.channels?.nim as NimConfig;

  if (!nimCfg) {
    return { success: false, error: "NIM channel not configured" };
  }

  const targetId = normalizeNimTarget(to);

  try {
    let client = getCachedNimClient(nimCfg);
    if (!client || !client.loggedIn) {
      client = await createNimClient(nimCfg);
      await client.login();
    }

    return await client.sendImage(targetId, imagePath, sessionType);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 发送文件消息
 */
export async function sendFileNim(params: {
  cfg: OpenClawConfig;
  to: string;
  filePath: string;
  sessionType?: NimSessionType;
}): Promise<NimSendResult> {
  const { cfg, to, filePath, sessionType = "p2p" } = params;
  const nimCfg = cfg.channels?.nim as NimConfig;

  if (!nimCfg) {
    return { success: false, error: "NIM channel not configured" };
  }

  const targetId = normalizeNimTarget(to);

  try {
    let client = getCachedNimClient(nimCfg);
    if (!client || !client.loggedIn) {
      client = await createNimClient(nimCfg);
      await client.login();
    }

    return await client.sendFile(targetId, filePath, sessionType);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 发送音频消息
 */
export async function sendAudioNim(params: {
  cfg: OpenClawConfig;
  to: string;
  audioPath: string;
  duration: number;
  sessionType?: NimSessionType;
}): Promise<NimSendResult> {
  const { cfg, to, audioPath, duration, sessionType = "p2p" } = params;
  const nimCfg = cfg.channels?.nim as NimConfig;

  if (!nimCfg) {
    return { success: false, error: "NIM channel not configured" };
  }

  const targetId = normalizeNimTarget(to);

  try {
    let client = getCachedNimClient(nimCfg);
    if (!client || !client.loggedIn) {
      client = await createNimClient(nimCfg);
      await client.login();
    }

    return await client.sendAudio(targetId, audioPath, duration, sessionType);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 发送视频消息
 */
export async function sendVideoNim(params: {
  cfg: OpenClawConfig;
  to: string;
  videoPath: string;
  duration: number;
  width: number;
  height: number;
  sessionType?: NimSessionType;
}): Promise<NimSendResult> {
  const { cfg, to, videoPath, duration, width, height, sessionType = "p2p" } = params;
  const nimCfg = cfg.channels?.nim as NimConfig;

  if (!nimCfg) {
    return { success: false, error: "NIM channel not configured" };
  }

  const targetId = normalizeNimTarget(to);

  try {
    let client = getCachedNimClient(nimCfg);
    if (!client || !client.loggedIn) {
      client = await createNimClient(nimCfg);
      await client.login();
    }

    return await client.sendVideo(targetId, videoPath, duration, width, height, sessionType);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 下载媒体文件
 */
export async function downloadNimMedia(params: {
  cfg: OpenClawConfig;
  url: string;
  filename?: string;
  maxBytes?: number;
  log?: (msg: string) => void;
}): Promise<NimMediaInfo | null> {
  const { cfg, url, filename, maxBytes = 30 * 1024 * 1024, log = console.log } = params;

  if (!url) {
    return null;
  }

  try {
    const runtime = getNimRuntime();
    const tempDir = (runtime as any)?.tempDir || os.tmpdir();
    
    // 生成文件名
    const ext = extname(url.split("?")[0]) || ".bin";
    const name = filename || `nim_${Date.now()}${ext}`;
    const localPath = join(tempDir, name);

    // 下载文件
    await downloadFile(url, localPath, maxBytes);

    // 获取文件大小
    const stats = fs.statSync(localPath);

    // 推断媒体类型
    const mediaType = inferMessageType(localPath);

    return {
      type: mediaType,
      url,
      name,
      size: stats.size,
      localPath,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`[nim] media download failed — error: ${errorMessage}`);
    return null;
  }
}

/**
 * 从媒体信息列表构建 payload
 */
export function buildNimMediaPayload(mediaList: NimMediaInfo[]): Record<string, unknown> {
  if (!mediaList || mediaList.length === 0) {
    return {};
  }

  return {
    MediaAttachments: mediaList.map((m) => ({
      type: m.type,
      url: m.url,
      name: m.name,
      size: m.size,
      localPath: m.localPath,
    })),
  };
}

/**
 * 推断消息的媒体类型占位符（用于 AI 显示）
 */
export function inferMediaPlaceholder(messageType: string): string {
  switch (messageType) {
    case "image":
      return "[图片]";
    case "audio":
      return "[语音消息]";
    case "video":
      return "[视频]";
    case "file":
      return "[文件]";
    case "geo":
    case "location":
      return "[位置]";
    default:
      return "[多媒体消息]";
  }
}

/**
 * 根据文件扩展名推断消息类型
 */
export function inferMessageType(filePath: string): "image" | "file" | "audio" | "video" {
  const ext = extname(filePath).toLowerCase();
  
  const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];
  const audioExts = [".mp3", ".wav", ".aac", ".m4a", ".ogg", ".amr"];
  const videoExts = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv"];

  if (imageExts.includes(ext)) return "image";
  if (audioExts.includes(ext)) return "audio";
  if (videoExts.includes(ext)) return "video";
  return "file";
}

/**
 * 辅助函数：下载文件
 */
function downloadFile(url: string, destPath: string, maxBytes: number = 30 * 1024 * 1024): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destPath);
    let downloadedBytes = 0;

    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // 处理重定向
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          try { fs.unlinkSync(destPath); } catch {}
          downloadFile(redirectUrl, destPath, maxBytes).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(destPath); } catch {}
        reject(new Error(`Download failed with status ${response.statusCode}`));
        return;
      }

      response.on("data", (chunk) => {
        downloadedBytes += chunk.length;
        if (downloadedBytes > maxBytes) {
          response.destroy();
          file.close();
          try { fs.unlinkSync(destPath); } catch {}
          reject(new Error(`File too large (>${maxBytes} bytes)`));
        }
      });

      response.pipe(file);

      file.on("finish", () => {
        file.close();
        resolve();
      });

      file.on("error", (err) => {
        file.close();
        try { fs.unlinkSync(destPath); } catch {}
        reject(err);
      });
    }).on("error", (err) => {
      file.close();
      try { fs.unlinkSync(destPath); } catch {}
      reject(err);
    });
  });
}
