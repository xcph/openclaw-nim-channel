/**
 * ensure-sdk.ts — 确保 node-nim native binary 存在
 *
 * openclaw 安装插件时使用 `npm install --ignore-scripts`，跳过了
 * node-nim 的 postinstall 脚本，导致 native binary 缺失。
 * 此模块在插件 service 启动时检测并补偿下载。
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pipeline } from "node:stream/promises";


const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PUBLISH_API =
  "https://admin.netease.im/public-service/free/publish/list?application=message&page=1&pageSize=50";
const CHANNEL = "message";
const PRODUCT = "nim";
const DOWNLOAD_TIMEOUT_MS = 300_000; // 5 min

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Logger {
  info?: (msg: string) => void;
  error?: (msg: string) => void;
}

interface PublishMember {
  filename: string;
  cdnlink: string;
}

// ---------------------------------------------------------------------------
// Platform helpers
// ---------------------------------------------------------------------------

function resolvePlatform(): string {
  return process.platform;
}

function resolveArch(): string {
  return process.platform === "darwin" ? "universal" : process.arch;
}

// ---------------------------------------------------------------------------
// Locate node-nim package
// ---------------------------------------------------------------------------

function resolveNodeNimDir(): string {
  const pkgJson = require.resolve("node-nim/package.json");
  return path.dirname(pkgJson);
}

function readNodeNimVersion(nodeNimDir: string): string {
  const raw = fs.readFileSync(path.join(nodeNimDir, "package.json"), "utf-8");
  const pkg = JSON.parse(raw) as { version?: string };
  return (pkg.version ?? "").split("-")[0]; // strip prerelease tag
}

// ---------------------------------------------------------------------------
// Binary existence check
// ---------------------------------------------------------------------------

function hasBinary(nodeNimDir: string): boolean {
  const releaseDir = path.join(nodeNimDir, "build", "Release");
  if (!fs.existsSync(releaseDir)) {
    return false;
  }
  const files = fs.readdirSync(releaseDir);
  // At least one .node or .so or .dylib or .dll file
  return files.some(
    (f) =>
      f.endsWith(".node") ||
      f.endsWith(".so") ||
      f.endsWith(".dylib") ||
      f.endsWith(".dll"),
  );
}

// ---------------------------------------------------------------------------
// Fetch download URL from publish API
// ---------------------------------------------------------------------------

function isMatchingPackage(
  member: PublishMember,
  platform: string,
  arch: string,
): boolean {
  const { filename } = member;
  const basicMatch =
    filename.includes(PRODUCT) &&
    filename.includes(platform) &&
    filename.includes(arch);
  if (platform === "win32") {
    return basicMatch && filename.includes("multi-threaded");
  }
  return basicMatch;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

function findPackageUrl(
  publishData: Record<string, PublishMember[]>,
  targetVersion: string,
  platform: string,
  arch: string,
): string | null {
  let latestVersion = "0.0.0";
  let latestUrl = "";
  let targetUrl = "";

  for (const [versionKey, members] of Object.entries(publishData)) {
    const match = members.find((m) => isMatchingPackage(m, platform, arch));
    if (!match) continue;

    if (compareVersions(latestVersion, versionKey) < 0) {
      latestVersion = versionKey;
      latestUrl = match.cdnlink;
    }
    if (targetVersion === versionKey) {
      targetUrl = match.cdnlink;
    }
  }

  return targetUrl || latestUrl || null;
}

async function resolveDownloadUrl(
  version: string,
  platform: string,
  arch: string,
  logger: Logger,
): Promise<string> {
  const { default: axios } = await import("axios");

  let url = PUBLISH_API;
  if (version && version !== "0.0.0") {
    url += `&version=${version}`;
  }

  const res = await axios.get(url, { timeout: 30_000 });
  const publishData = res.data?.data?.[CHANNEL] as
    | Record<string, PublishMember[]>
    | undefined;

  if (!publishData) {
    throw new Error("Failed to fetch SDK publish data from server");
  }

  const downloadUrl = findPackageUrl(publishData, version, platform, arch);
  if (!downloadUrl) {
    throw new Error(
      `SDK package not found for ${platform} (${arch}), version ${version}`,
    );
  }

  logger.info?.(`Resolved download URL for ${platform}-${arch}`);
  return downloadUrl;
}

// ---------------------------------------------------------------------------
// Download & extract (using only Node.js builtins + axios)
// ---------------------------------------------------------------------------

async function downloadFile(
  url: string,
  destPath: string,
  logger: Logger,
): Promise<void> {
  const { default: axios } = await import("axios");

  const response = await axios({
    method: "GET",
    url,
    responseType: "stream",
    timeout: DOWNLOAD_TIMEOUT_MS,
  });

  const totalBytes = parseInt(
    response.headers["content-length"] ?? "0",
    10,
  );
  let downloadedBytes = 0;
  let lastLogPercent = -10;

  const writer = fs.createWriteStream(destPath);

  response.data.on("data", (chunk: Buffer) => {
    downloadedBytes += chunk.length;
    if (totalBytes > 0) {
      const percent = Math.floor((downloadedBytes * 100) / totalBytes);
      if (percent - lastLogPercent >= 10) {
        lastLogPercent = percent;
        logger.info?.(
          `Downloading: ${percent}% (${formatBytes(downloadedBytes)}/${formatBytes(totalBytes)})`,
        );
      }
    }
  });

  await pipeline(response.data, writer);
  logger.info?.("Download complete");
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

async function extractTarGz(
  archivePath: string,
  destDir: string,
  logger: Logger,
): Promise<void> {
  // Use child_process tar — universally available on macOS/Linux,
  // avoids pulling in a tar library dependency.
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  await fsp.mkdir(destDir, { recursive: true });
  logger.info?.("Extracting archive...");

  await execFileAsync("tar", ["-xzf", archivePath, "-C", destDir]);
  logger.info?.("Extraction complete");
}

async function extractZip(
  archivePath: string,
  destDir: string,
  logger: Logger,
): Promise<void> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  await fsp.mkdir(destDir, { recursive: true });
  logger.info?.("Extracting archive...");

  if (process.platform === "win32") {
    // PowerShell Expand-Archive
    await execFileAsync("powershell", [
      "-NoProfile",
      "-Command",
      `Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force`,
    ]);
  } else {
    await execFileAsync("unzip", ["-o", archivePath, "-d", destDir]);
  }
  logger.info?.("Extraction complete");
}

// ---------------------------------------------------------------------------
// Find library files in extracted archive (mirrors download-sdk.js logic)
// ---------------------------------------------------------------------------

function findLibraryDir(
  extractDir: string,
  platform: string,
): string | null {
  const expectedSubDir = platform === "win32" ? "bin" : "lib";
  const items = fs.readdirSync(extractDir);

  // Strategy 1: look for directory containing bin/ or lib/
  for (const item of items) {
    const itemPath = path.join(extractDir, item);
    if (fs.statSync(itemPath).isDirectory()) {
      const subDirPath = path.join(itemPath, expectedSubDir);
      if (fs.existsSync(subDirPath)) {
        return subDirPath;
      }
    }
  }

  // Strategy 2: recursively search for .node files
  const searchForNodeFiles = (searchPath: string): string | null => {
    const entries = fs.readdirSync(searchPath);
    for (const entry of entries) {
      const fullPath = path.join(searchPath, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const found = searchForNodeFiles(fullPath);
        if (found) return found;
      } else if (entry.endsWith(".node")) {
        return searchPath;
      }
    }
    return null;
  };

  return searchForNodeFiles(extractDir);
}

// ---------------------------------------------------------------------------
// Install: move library files to build/Release
// ---------------------------------------------------------------------------

async function installLibraryFiles(
  libraryDir: string,
  targetDir: string,
  logger: Logger,
): Promise<void> {
  await fsp.mkdir(targetDir, { recursive: true });

  const files = fs.readdirSync(libraryDir);
  for (const file of files) {
    const src = path.join(libraryDir, file);
    if (fs.statSync(src).isFile()) {
      const dest = path.join(targetDir, file);
      await fsp.copyFile(src, dest);
      logger.info?.(`Installed: ${file}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

async function removeDir(dirPath: string): Promise<void> {
  if (fs.existsSync(dirPath)) {
    await fsp.rm(dirPath, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function ensureNimSdkBinary(params: {
  logger?: Logger;
}): Promise<void> {
  const logger: Logger = {
    info: params.logger?.info ?? ((msg) => console.log(`[node-nim] ${msg}`)),
    error: params.logger?.error ?? ((msg) => console.error(`[node-nim] ${msg}`)),
  };

  // 1. Locate node-nim
  let nodeNimDir: string;
  try {
    nodeNimDir = resolveNodeNimDir();
  } catch {
    logger.error?.("node-nim package not found — skipping SDK download");
    return;
  }

  // 2. Check if binary already exists
  if (hasBinary(nodeNimDir)) {
    logger.info?.("Native binary already present, skipping download");
    return;
  }

  // 3. Read version from node-nim package.json
  const version = readNodeNimVersion(nodeNimDir);
  const platform = resolvePlatform();
  const arch = resolveArch();

  logger.info?.(
    `Native binary missing — downloading SDK v${version} for ${platform}-${arch}`,
  );

  // 4. Resolve download URL
  const downloadUrl = await resolveDownloadUrl(version, platform, arch, logger);

  // 5. Download to temp directory
  const tempDir = path.join(nodeNimDir, ".sdk-download-tmp");
  await removeDir(tempDir);
  await fsp.mkdir(tempDir, { recursive: true });

  const urlPath = new URL(downloadUrl).pathname;
  const fileName = path.basename(urlPath) || "sdk-archive";
  const archivePath = path.join(tempDir, fileName);

  try {
    await downloadFile(downloadUrl, archivePath, logger);

    // 6. Extract
    const extractDir = path.join(tempDir, "extracted");
    if (fileName.endsWith(".tar.gz") || fileName.endsWith(".tgz")) {
      await extractTarGz(archivePath, extractDir, logger);
    } else if (fileName.endsWith(".zip")) {
      await extractZip(archivePath, extractDir, logger);
    } else {
      throw new Error(`Unsupported archive format: ${fileName}`);
    }

    // 7. Find library files
    const libraryDir = findLibraryDir(extractDir, platform);
    if (!libraryDir) {
      throw new Error(
        "No library files found in extracted archive. " +
          `Expected structure: <package>/${platform === "win32" ? "bin" : "lib"}/`,
      );
    }

    // 8. Install to build/Release
    const targetDir = path.join(nodeNimDir, "build", "Release");
    await removeDir(targetDir);
    await installLibraryFiles(libraryDir, targetDir, logger);

    logger.info?.("SDK binary installation complete");
  } finally {
    // 9. Cleanup temp directory
    await removeDir(tempDir).catch(() => undefined);
  }
}
