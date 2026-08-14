import * as fs from "fs/promises";
import path from "path";
import os from "os";
import fsSync from "fs";
import { planPs2Import, ImportPlan } from "./import-planner.service";
import { safeCopyFile, CopyProgress } from "./safe-copy.service";
import { convertIsoToUl, UlTransferProgress } from "./ul-conversion.service";
import { streamZsoContents } from "./zso.service";
import { sanitizeGameFilename } from "../utils/sanitize";
import { requireGameId } from "../utils/game-id";
import { assertPathContained } from "../utils/path-safety";

export interface SafeImportRequest {
  sourcePath: string;
  oplRoot: string;
  gameId: string;
  gameName: string;
  media?: "CD" | "DVD";
  keepOriginalName?: boolean;
  verifySha256?: boolean;
}
export async function preflightSafeImport(request: SafeImportRequest): Promise<ImportPlan & { gameId: string; gameName: string; destination: string }> {
  const gameId = requireGameId(request.gameId);
  const gameName = sanitizeGameFilename(request.gameName);
  const media = request.media || "DVD";
  const plan = await planPs2Import(request.sourcePath, request.oplRoot, media);
  const extension = path.extname(request.sourcePath).toLowerCase();
  const fileName = request.keepOriginalName ? `${gameName}${extension}` : `${gameId}.${gameName}${extension}`;
  return { ...plan, gameId, gameName, destination: plan.strategy === "direct-copy" ? path.join(request.oplRoot, media, fileName) : path.join(request.oplRoot, "ul.cfg") };
}

async function inflateZso(zsoPath: string, signal?: AbortSignal, onProgress?: (message: string) => void): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "opl-zso-"));
  const isoPath = path.join(directory, `${path.basename(zsoPath, path.extname(zsoPath))}.iso`);
  const fd = fsSync.openSync(isoPath, "wx");
  try {
    let bytes = 0;
    const result = await streamZsoContents(zsoPath, (chunk) => {
      if (signal?.aborted) throw new DOMException("ZSO inflation cancelled", "AbortError");
      fsSync.writeSync(fd, chunk);
      bytes += chunk.length;
      if (bytes % (64 * 1024 * 1024) < chunk.length) onProgress?.(`Decompressing ZSO: ${Math.round(bytes / 1024 / 1024)} MiB`);
    });
    fsSync.fsyncSync(fd);
    if (!result.success) throw new Error(result.message || "Failed to decompress ZSO");
    return { path: isoPath, cleanup: () => fs.rm(directory, { recursive: true, force: true }) };
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true });
    throw error;
  } finally { fsSync.closeSync(fd); }
}

export async function runSafeImport(
  request: SafeImportRequest,
  options: {
    signal?: AbortSignal;
    onCopyProgress?: (progress: CopyProgress) => void;
    onUlProgress?: (progress: UlTransferProgress) => void;
    onStage?: (stage: string) => void;
  } = {},
): Promise<{ success: boolean; message: string; plan: ImportPlan; path?: string }> {
  const preflight = await preflightSafeImport(request);
  if (preflight.sizeBytes > (await fs.statfs(request.oplRoot)).bavail * (await fs.statfs(request.oplRoot)).bsize) {
    return { success: false, message: "Not enough free space on destination.", plan: preflight };
  }
  if (preflight.strategy === "direct-copy") {
    const destination = assertPathContained(request.oplRoot, preflight.destination);
    options.onStage?.("Copying to temporary .part file");
    const copied = await safeCopyFile(request.sourcePath, destination, {
      verifySha256: request.verifySha256 !== false,
      signal: options.signal,
      onProgress: options.onCopyProgress,
    });
    return { success: true, message: `Installed and verified ${path.basename(destination)}.`, plan: preflight, path: copied.path };
  }
  let isoPath = request.sourcePath;
  let cleanup: (() => Promise<void>) | undefined;
  try {
    if (preflight.strategy === "zso-to-ul") {
      options.onStage?.("Decompressing ZSO to a temporary ISO");
      const inflated = await inflateZso(request.sourcePath, options.signal, options.onStage);
      isoPath = inflated.path;
      cleanup = inflated.cleanup;
    }
    options.onStage?.("Preparing USBExtreme / UL conversion");
    const converted = await convertIsoToUl(isoPath, request.oplRoot, request.gameName, request.gameId, request.media || "DVD", {
      signal: options.signal,
      onProgress: options.onStage,
      onTransferProgress: options.onUlProgress,
    });
    return { success: converted.success, message: converted.message, plan: preflight, path: converted.files?.[0] };
  } finally { await cleanup?.(); }
}
