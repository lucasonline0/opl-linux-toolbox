import { ipcMain } from "electron";
import { deleteGameAndRelatedFiles } from "../services/delete.service";
import {
  deleteApp,
  deleteAppWithProgress,
} from "../services/apps.service";
import path from "path";
import * as fs from "fs/promises";
import { requireLibraryRoot } from "../services/library-registry";
import { removeUlGame } from "../services/ul.service";

export function registerDeleteIpc(): void {
  ipcMain.handle(
    "delete-game-and-related-files",
    async (
      event,
      gamePath: string,
      artDir: string,
      gameId: string,
      launcherFolder?: string,
      bootName?: string
    ) => {
      const root = requireLibraryRoot(path.dirname(artDir));
      if (path.resolve(artDir) !== path.join(root, "ART")) throw new Error("Invalid artwork directory");
      return deleteGameAndRelatedFiles(gamePath, artDir, gameId, launcherFolder, (entry) => {
        event.sender.send("delete-ps1-progress", entry);
      }, bootName);
    }
  );

  ipcMain.handle("delete-ul-game", async (_event, rootValue: string, gameId: string, removeArtwork = true) => {
    const root = requireLibraryRoot(rootValue);
    const result = await removeUlGame(root, gameId);
    const artwork: string[] = [];
    if (removeArtwork) {
      const artDir = path.join(root, "ART");
      for (const name of await fs.readdir(artDir).catch(() => [])) {
        if (name.startsWith(`${gameId}_`) && !name.startsWith(".")) {
          await fs.unlink(path.join(artDir, name));
          artwork.push(path.join(artDir, name));
        }
      }
    }
    return { success: true, entries: [...result.removed, ...artwork].map((file) => ({ label: "UL/artwork", path: file, success: true })), backup: result.backup };
  });

  ipcMain.handle(
    "delete-app",
    async (_event, oplRoot: string, folder: string) => {
      return deleteApp(oplRoot, folder);
    }
  );

  ipcMain.handle(
    "delete-app-with-progress",
    async (event, oplRoot: string, folder: string, bootName: string) => {
      return deleteAppWithProgress(oplRoot, folder, bootName, (entry) => {
        event.sender.send("delete-app-progress", entry);
      });
    }
  );
}
