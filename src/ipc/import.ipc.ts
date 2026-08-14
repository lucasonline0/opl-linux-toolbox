import { ipcMain } from "electron";
import { importPs2CdGame } from "../services/cd-import.service";
import { importPs1Game } from "../services/ps1-import.service";
import { importApp } from "../services/apps.service";
import { preflightSafeImport, runSafeImport, SafeImportRequest } from "../services/safe-import.service";
import { requireLibraryRoot } from "../services/library-registry";

const activeImports = new Map<string, AbortController>();

export function registerImportIpc(): void {
  ipcMain.handle("preflight-safe-import", async (_event, request: SafeImportRequest) => {
    request.oplRoot = requireLibraryRoot(request.oplRoot);
    return preflightSafeImport(request);
  });

  ipcMain.handle("run-safe-import", async (event, jobId: string, request: SafeImportRequest) => {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(jobId) || activeImports.has(jobId)) throw new Error("Invalid or duplicate import job ID");
    request.oplRoot = requireLibraryRoot(request.oplRoot);
    const controller = new AbortController();
    activeImports.set(jobId, controller);
    try {
      return await runSafeImport(request, {
        signal: controller.signal,
        onStage: (stage) => event.sender.send("safe-import-progress", { jobId, stage }),
        onCopyProgress: (progress) => event.sender.send("safe-import-progress", { jobId, ...progress }),
        onUlProgress: (progress) => event.sender.send("safe-import-progress", { jobId, ...progress }),
      });
    } finally { activeImports.delete(jobId); }
  });

  ipcMain.handle("cancel-safe-import", async (_event, jobId: string) => {
    const controller = activeImports.get(jobId);
    if (!controller) return false;
    controller.abort();
    return true;
  });
  ipcMain.handle(
    "import-ps2-cd-game",
    async (
      event,
      cueFilePath: string,
      oplRoot: string,
      gameId: string | undefined,
      gameName: string | undefined,
      downloadArtwork: boolean
    ) => {
      return importPs2CdGame(
        cueFilePath,
        oplRoot,
        gameId,
        gameName,
        downloadArtwork,
        (percent, stage) => {
          event.sender.send("ps2-cd-import-progress", { percent, stage });
        }
      );
    }
  );

  ipcMain.handle(
    "import-ps1-game",
    async (
      event,
      cueFilePath: string,
      oplRoot: string,
      elfPrefix: string,
      downloadArtwork: boolean
    ) => {
      return importPs1Game(
        cueFilePath,
        oplRoot,
        elfPrefix,
        downloadArtwork,
        (percent, stage) => {
          event.sender.send("ps1-import-progress", { percent, stage });
        }
      );
    }
  );

  ipcMain.handle(
    "import-app",
    async (_event, oplRoot: string, elfPath: string, title: string) => {
      return importApp(oplRoot, elfPath, title);
    }
  );
}
