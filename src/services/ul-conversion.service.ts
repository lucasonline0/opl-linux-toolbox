import { spawn } from "child_process";
import * as fs from "fs/promises";
import path from "path";
import { snapshotUl, rollbackUl, scanUlInstallations } from "./ul.service";
import { requireGameId } from "../utils/game-id";

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
  options: { signal?: AbortSignal; onProgress?: (message: string) => void } = {},
): Promise<{ success: boolean; message: string; files?: string[] }> {
  const gameId = requireGameId(gameIdValue);
  const executable = await findExecutable();
  const snapshot = await snapshotUl(oplRoot);
  const safeTitle = title.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 32).padEnd(3, "_");
  let output = "";
  const child = spawn(executable, [isoPath, oplRoot, safeTitle, media], {
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const collect = (chunk: Buffer) => {
    output = (output + chunk.toString("utf8")).slice(-16_384);
    const line = output.trim().split(/\r?\n/).at(-1);
    if (line) options.onProgress?.(line);
  };
  child.stdout?.on("data", collect);
  child.stderr?.on("data", collect);
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
    if (options.signal?.aborted) {
      await rollbackUl(oplRoot, snapshot);
      return { success: false, message: "UL conversion cancelled and rolled back." };
    }
    if (exitCode !== 0) {
      await rollbackUl(oplRoot, snapshot);
      return { success: false, message: `iso2opl failed (${exitCode}); changes rolled back. ${output.trim().split(/\r?\n/).slice(-2).join(" | ")}` };
    }
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
    await abort();
    await rollbackUl(oplRoot, snapshot);
    return { success: false, message: `${error?.message || error}; UL changes rolled back.` };
  } finally {
    options.signal?.removeEventListener("abort", abort);
  }
}
