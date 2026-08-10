import * as fs from "fs/promises";
import path from "path";
import os from "os";
import { APP_CONFIG } from "../app-config";
import { createLogger, formatBytes } from "../logger";
import { requireGameId } from "../utils/game-id";
import { assertPathContained } from "../utils/path-safety";

const log = createLogger("artwork");
const IMAGE_EXTENSION = /\.(png|jpe?g)$/i;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface AvailableArtEntry {
  type: string;
  fileName: string;
  downloadUrl: string;
  size?: number;
}

export interface ArtworkDownloadEntry extends AvailableArtEntry {
  savedPath?: string;
  error?: string;
  bytes?: number;
}

interface ArtServiceOptions {
  cacheDir?: string;
  apiBaseUrl?: string;
  rawBaseUrl?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
  concurrency?: number;
  allowHttpForTests?: boolean;
}

interface CacheDocument {
  fetchedAt: number;
  entries: AvailableArtEntry[];
}

function defaultCacheDir(): string {
  const root = process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
  return path.join(root, APP_CONFIG.cacheSlug, "art-index");
}

function validateImageBytes(bytes: Buffer, extension: string): boolean {
  if (!bytes.length) return false;
  if (extension === ".png") {
    return bytes.length >= 24 &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0;
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 &&
      bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  }
  return false;
}

function validateWithElectron(bytes: Buffer): boolean {
  try {
    // Dynamic loading keeps the core service testable with plain Node.
    const electronModule = require("electron") as any;
    if (!electronModule?.nativeImage?.createFromBuffer) return true;
    return !electronModule.nativeImage.createFromBuffer(bytes).isEmpty();
  } catch {
    return true;
  }
}

export async function isValidImageFile(filePath: string): Promise<boolean> {
  const extension = path.extname(filePath).toLowerCase();
  const bytes = await fs.readFile(filePath);
  return validateImageBytes(bytes, extension) && validateWithElectron(bytes);
}

function artType(gameId: string, fileName: string): string {
  return fileName.slice(`${gameId}_`.length).replace(IMAGE_EXTENSION, "");
}

export class ArtDatabaseService {
  private readonly cacheDir: string;
  private readonly apiBaseUrl: string;
  private readonly rawBaseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly concurrency: number;
  private readonly allowHttpForTests: boolean;

  constructor(options: ArtServiceOptions = {}) {
    this.cacheDir = options.cacheDir || defaultCacheDir();
    this.apiBaseUrl = options.apiBaseUrl || `https://api.github.com/repos/${APP_CONFIG.artRepository}/contents`;
    this.rawBaseUrl = options.rawBaseUrl || `https://raw.githubusercontent.com/${APP_CONFIG.artRepository}/${APP_CONFIG.artBranch}`;
    this.fetchFn = options.fetchFn || fetch;
    this.timeoutMs = options.timeoutMs ?? 12_000;
    this.retries = options.retries ?? 2;
    this.concurrency = Math.max(1, Math.min(options.concurrency ?? 3, 4));
    this.allowHttpForTests = !!options.allowHttpForTests;
  }

  private cachePath(gameId: string, system: "PS1" | "PS2"): string {
    return path.join(this.cacheDir, `${system}-${gameId}.json`);
  }

  private async readCache(gameId: string, system: "PS1" | "PS2"): Promise<CacheDocument | null> {
    try {
      return JSON.parse(await fs.readFile(this.cachePath(gameId, system), "utf8")) as CacheDocument;
    } catch { return null; }
  }

  private async writeCache(gameId: string, system: "PS1" | "PS2", entries: AvailableArtEntry[]): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
    const target = this.cachePath(gameId, system);
    const temporary = `${target}.part`;
    await fs.writeFile(temporary, JSON.stringify({ fetchedAt: Date.now(), entries } satisfies CacheDocument));
    await fs.rename(temporary, target);
  }

  async clearCache(): Promise<void> {
    await fs.rm(this.cacheDir, { recursive: true, force: true });
  }

  private async request(url: string, signal?: AbortSignal): Promise<Response> {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && !this.allowHttpForTests) throw new Error("Artwork downloads require HTTPS");
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      if (signal?.aborted) throw new DOMException("Artwork request cancelled", "AbortError");
      const timeout = new AbortController();
      const timer = setTimeout(() => timeout.abort(), this.timeoutMs);
      const abort = () => timeout.abort();
      signal?.addEventListener("abort", abort, { once: true });
      try {
        const headers: Record<string, string> = {
          Accept: "application/vnd.github+json",
          "User-Agent": APP_CONFIG.cacheSlug,
        };
        if (process.env.GITHUB_TOKEN && parsed.hostname === "api.github.com") {
          headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
        }
        const response = await this.fetchFn(url, { headers, signal: timeout.signal, redirect: "follow" });
        if (new URL(response.url || url).protocol !== "https:" && !this.allowHttpForTests) {
          throw new Error("Artwork redirect left HTTPS");
        }
        if (response.status >= 500 && attempt < this.retries) {
          await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        if (signal?.aborted) throw new DOMException("Artwork request cancelled", "AbortError");
        if (attempt >= this.retries) throw error;
        await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      }
    }
    throw lastError;
  }

  async discover(gameIdValue: string, system: "PS1" | "PS2" = "PS2", signal?: AbortSignal, force = false): Promise<{ success: boolean; data: AvailableArtEntry[]; cached?: boolean; message?: string }> {
    const gameId = requireGameId(gameIdValue);
    const cached = await this.readCache(gameId, system);
    if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return { success: true, data: cached.entries, cached: true };
    }
    const url = `${this.apiBaseUrl}/${system}/${gameId}`;
    try {
      const response = await this.request(url, signal);
      if (response.status === 404) {
        await this.writeCache(gameId, system, []);
        return { success: true, data: [], message: `No artwork available for ${gameId}.` };
      }
      if (!response.ok) throw new Error(`GitHub artwork API returned HTTP ${response.status}`);
      const json = await response.json() as any;
      if (!Array.isArray(json)) throw new Error("Artwork API did not return a directory listing");
      const prefix = `${gameId}_`;
      const entries: AvailableArtEntry[] = json
        .filter((entry: any) => entry?.type === "file" && typeof entry.name === "string")
        .filter((entry: any) => entry.name.startsWith(prefix) && IMAGE_EXTENSION.test(entry.name))
        .map((entry: any) => ({
          type: artType(gameId, entry.name),
          fileName: entry.name,
          downloadUrl: typeof entry.download_url === "string" && entry.download_url
            ? entry.download_url
            : `${this.rawBaseUrl}/${system}/${gameId}/${encodeURIComponent(entry.name)}`,
          size: typeof entry.size === "number" ? entry.size : undefined,
        }));
      await this.writeCache(gameId, system, entries);
      log.info(`Discovered ${entries.length} ${system} artwork asset(s) for ${gameId}`);
      return { success: true, data: entries };
    } catch (error: any) {
      if (cached) {
        log.warn(`Artwork API failed for ${gameId}; using cached index: ${error?.message || error}`);
        return { success: true, data: cached.entries, cached: true, message: `Using cached artwork index: ${error?.message || error}` };
      }
      return { success: false, data: [], message: error?.message || String(error) };
    }
  }

  private async downloadOne(artDir: string, entry: AvailableArtEntry, signal?: AbortSignal): Promise<ArtworkDownloadEntry> {
    const extension = path.extname(entry.fileName).toLowerCase();
    const finalPath = assertPathContained(artDir, path.join(artDir, entry.fileName));
    const temporary = assertPathContained(artDir, path.join(artDir, `.${entry.fileName}.part`));
    try {
      const response = await this.request(entry.downloadUrl, signal);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get("content-type")?.toLowerCase() || "";
      if (!contentType.startsWith("image/") && contentType !== "application/octet-stream") {
        throw new Error(`Unexpected Content-Type: ${contentType || "missing"}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!validateImageBytes(bytes, extension) || !validateWithElectron(bytes)) {
        throw new Error("Downloaded file is not a valid non-empty image");
      }
      await fs.writeFile(temporary, bytes, { flag: "w" });
      const handle = await fs.open(temporary, "r");
      await handle.sync();
      await handle.close();
      await fs.rename(temporary, finalPath);
      log.verbose(`Saved ${entry.fileName} (${formatBytes(bytes.length)}) → ${finalPath}`);
      return { ...entry, savedPath: finalPath, bytes: bytes.length };
    } catch (error: any) {
      await fs.unlink(temporary).catch(() => undefined);
      return { ...entry, error: error?.message || String(error) };
    }
  }

  async downloadAll(artDir: string, gameIdValue: string, system: "PS1" | "PS2" = "PS2", options: { signal?: AbortSignal; forceDiscovery?: boolean; types?: string[] } = {}): Promise<{ success: boolean; data: ArtworkDownloadEntry[]; message?: string }> {
    const gameId = requireGameId(gameIdValue);
    await fs.mkdir(artDir, { recursive: true });
    const discovery = await this.discover(gameId, system, options.signal, options.forceDiscovery);
    if (!discovery.success) return { success: false, data: [], message: discovery.message };
    const typeSet = options.types?.length ? new Set(options.types.map((value) => value.toUpperCase())) : null;
    const pending = discovery.data.filter((entry) => !typeSet || typeSet.has(entry.type.toUpperCase()));
    const results = new Array<ArtworkDownloadEntry>(pending.length);
    let cursor = 0;
    const worker = async () => {
      while (cursor < pending.length) {
        const index = cursor++;
        results[index] = await this.downloadOne(artDir, pending[index], options.signal);
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, pending.length) }, worker));
    const saved = results.filter((item) => item.savedPath).length;
    const failed = results.length - saved;
    return {
      success: saved > 0 || results.length === 0,
      data: results,
      message: results.length === 0
        ? `No artwork available for ${gameId}.`
        : `Artwork: ${saved}/${results.length} downloaded${failed ? `; ${failed} failed` : ""}.`,
    };
  }
}

export const artDatabase = new ArtDatabaseService();

export async function downloadArtByGameId(
  dirPath: string,
  gameId: string,
  system: "PS1" | "PS2" = "PS2",
  _saveAsName?: string,
  artTypes?: string[],
) {
  return artDatabase.downloadAll(dirPath, gameId, system, { types: artTypes });
}

export async function listAvailableArt(gameId: string, system: "PS1" | "PS2" = "PS2") {
  return artDatabase.discover(gameId, system);
}

export async function checkArtFilesExist(artDir: string, filenames: string[]) {
  const existing: string[] = [];
  for (const name of filenames) {
    if (path.basename(name) !== name) continue;
    try { await fs.access(path.join(artDir, name)); existing.push(name); } catch { /* missing */ }
  }
  return existing;
}

export async function clearArtworkCache() {
  await artDatabase.clearCache();
  return { success: true };
}
