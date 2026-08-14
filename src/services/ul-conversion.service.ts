import { spawn } from "child_process";
import * as fs from "fs/promises";
import path from "path";
import { snapshotUl, rollbackUl, scanUlInstallations } from "./ul.service";
import { requireGameId } from "../utils/game-id";

export interface UlTransferProgress {
  stage: string;
  percent: number;
  bytes: number;
  totalBytes: number;
  bytesPerSecond: number;
  etaSeconds: number | null;
}

function formatBytes(bytes: number): string {
  const gib = 1024 ** 3;
  const mib = 1024 ** 2;
  if (bytes >= gib) return `${(bytes / gib).toFixed(2)} GiB`;
  return `${(bytes / mib).toFixed(1)} MiB`;
}

function formatEta(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "--";
  const rounded = Math.max(0, Math.ceil(seconds));
  if (rounded < 60) return `${rounded}s`;
  const minutes = Math.floor(rounded / 60);
  return `${minutes}m ${rounded % 60}s`;
}

export function buildUlTransferProgress(
  bytes: number,
  totalBytes: number,
  elapsedSeconds: number,
): UlTransferProgress {
  const safeTotal = Math.max(0, totalBytes);
  const safeBytes = safeTotal > 0
    ? Math.min(Math.max(0, bytes), safeTotal)
    : Math.max(0, bytes);
  const speed = elapsedSeconds > 0.001 ? safeBytes / elapsedSeconds : 0;
  const eta = speed > 0 && safeTotal > safeBytes
    ? (safeTotal - safeBytes) / speed
    : safeTotal > 0 && safeBytes >= safeTotal
      ? 0
      : null;
  const percent = safeTotal > 0 ? (safeBytes / safeTotal) * 100 : 0;

  return {
    stage: `Installing UL · ${formatBytes(safeBytes)} / ${formatBytes(safeTotal)} · ${(speed / 1024 / 1024).toFixed(1)} MiB/s · ETA ${formatEta(eta)}`,
    percent,
    bytes: safeBytes,
    totalBytes: safeTotal,
    bytesPerSecond: speed,
    etaSeconds: eta,
  };
}

/**
 * Measure only UL chunk files created after the snapshot. Polling the actual
 * destination files makes progress independent from iso2opl stdout buffering,
 * which can stay silent for a long time on slow USB drives.
 */
export async function measureNewUlBytes(
  root: string,
  existingFiles: Set<string>,
): Promise<number> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const sizes = await Promise.all(entries.map(async (entry) => {
    if (
      !entry.isFile() ||
      entry.name === "ul.cfg" ||
      !entry.name.startsWith("ul.") ||
      existingFiles.has(entry.name)
    ) {
      return 0;
    }
    const stat = await fs.stat(path.join(root, entry.name)).catch(() => null);
    return stat?.size ?? 0;
  }));
  return sizes.reduce((total, size) => total + size, 0);
}

function executableCandidates(): string[] {
  return [
    process.env.ISO2OPL_PATH || "",
    path.join(process.resourcesPath || "", "app.asar.unpacked", "assets", "bin", "iso2opl"),
    path.join(process.resourcesPath || "", "assets", "bin", "iso2opl"),
    path.join(process.cwd(), "assets", "bin", "iso2opl"),
    path.resolve(__dirname, "../../../assets/bin/iso2opl"),
    "iso2opl",
  ].filter(Boolean);
}

async function findExecutable(): Promise<string> {
  for (const candidate of executableCandidates()) {
    if (candidate === "iso2opl") return candidate;
    try {
      await fs.access(candidate, 1);
      return candidate;
    } catch { /* try next */ }
  }
  throw new Error("iso2opl executable was not found");
}

function waitForExit(child: ReturnType<typeof spawn>, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve(true);
    const timer = setTimeout(() => resolve(false), timeoutMs);
    child.once("exit", () => { clearTimeout(timer); resolve(true); });
  });
}

export async function convertIsoToUl(
  isoPath: string,
  oplRoot: string,
  title: string,
  gameIdValue: string,
  media: "CD" | "DVD",
  options: {
    signal?: AbortSignal;
    onProgress?: (message: string) => void;
    onTransferProgress?: (progress: UlTransferProgress) => void;
  } = {},
): Promise<{ success: boolean; message: string; files?: string[] }> {
  const gameId = requireGameId(gameIdValue);
  const executable = await findExecutable();
  const snapshot = await snapshotUl(oplRoot);
  const totalBytes = (await fs.stat(isoPath)).size;
  const safeTitle = title.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 32).padEnd(3, "_");
  const startedAt = Date.now();
  let output = "";
  let lastMeasuredBytes = 0;
  let pollInFlight = false;
  let progressEnabled = true;

  const emitTransferProgress = async () => {
    if (!progressEnabled || pollInFlight || !options.onTransferProgress) return;
    pollInFlight = true;
    try {
      const measured = await measureNewUlBytes(oplRoot, snapshot.files);
      lastMeasuredBytes = Math.max(lastMeasuredBytes, measured);
      options.onTransferProgress(buildUlTransferProgress(
        lastMeasuredBytes,
        totalBytes,
        Math.max((Date.now() - startedAt) / 1000, 0.001),
      ));
    } finally {
      pollInFlight = false;
    }
  };

  const child = spawn(executable, [isoPath, oplRoot, safeTitle, media], {
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const progressTimer = setInterval(() => void emitTransferProgress(), 500);
  void emitTransferProgress();

  const collect = (chunk: Buffer) => {
    output = (output + chunk.toString("utf8")).slice(-16_384);
    const line = output.trim().split(/\r?\n/).at(-1);
    // iso2opl can buffer these lines for a long time when stdout is a pipe.
    // The UI uses destination-file polling above for reliable transfer progress.
    if (line && !/^Writing\s+\d+\s+sectors\b/i.test(line)) options.onProgress?.(line);
  };
  child.stdout?.on("data", collect);
  child.stderr?.on("data", collect);

  const stopProgress = () => {
    progressEnabled = false;
    clearInterval(progressTimer);
  };

  const abort = async () => {
    if (child.exitCode !== null) return;
    child.kill("SIGINT");
    if (!(await waitForExit(child, 3_000))) child.kill("SIGKILL");
  };
  options.signal?.addEventListener("abort", abort, { once: true });

  try {
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    });
    stopProgress();

    if (options.signal?.aborted) {
      await rollbackUl(oplRoot, snapshot);
      return { success: false, message: "UL conversion cancelled and rolled back." };
    }
    if (exitCode !== 0) {
      await rollbackUl(oplRoot, snapshot);
      return { success: false, message: `iso2opl failed (${exitCode}); changes rolled back. ${output.trim().split(/\r?\n/).slice(-2).join(" | ")}` };
    }

    options.onTransferProgress?.(buildUlTransferProgress(
      totalBytes,
      totalBytes,
      Math.max((Date.now() - startedAt) / 1000, 0.001),
    ));

    const scan = await scanUlInstallations(oplRoot);
    const installed = scan.find((entry) => entry.gameId === gameId && entry.kind === "complete");
    if (!installed) {
      await rollbackUl(oplRoot, snapshot);
      return { success: false, message: `iso2opl output did not validate for ${gameId}; changes rolled back.` };
    }
    const cfg = await fs.open(path.join(oplRoot, "ul.cfg"), "r");
    await cfg.sync();
    await cfg.close();
    return { success: true, message: `Installed ${gameId} as validated USBExtreme/UL.`, files: installed.files };
  } catch (error: any) {
    stopProgress();
    await abort();
    await rollbackUl(oplRoot, snapshot);
    return { success: false, message: `${error?.message || error}; UL changes rolled back.` };
  } finally {
    stopProgress();
    options.signal?.removeEventListener("abort", abort);
  }
}
