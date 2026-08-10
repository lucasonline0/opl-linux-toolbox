import { dialog, ipcMain, shell } from "electron";
import path from "path";
import {
  downloadArtByGameId,
  checkArtFilesExist,
  listAvailableArt,
  clearArtworkCache,
  isValidImageFile,
} from "../services/artwork.service";
import { requireLibraryRoot } from "../services/library-registry";
import { requireGameId } from "../utils/game-id";
import { safeCopyFile } from "../services/safe-copy.service";

export function registerArtworkIpc(): void {
  ipcMain.handle(
    "download-art-by-gameid",
    async (
      _event,
      dirPath: string,
      gameId: string,
      system?: "PS1" | "PS2",
      saveAsName?: string,
      artTypes?: string[]
    ) => {
      return downloadArtByGameId(dirPath, gameId, system || "PS2", saveAsName, artTypes);
    }
  );

  ipcMain.handle("check-art-files-exist", async (_event, artDir: string, filenames: string[]) => {
    return checkArtFilesExist(artDir, filenames);
  });

  ipcMain.handle("list-available-art", async (_event, gameId: string, system?: "PS1" | "PS2") => {
    return listAvailableArt(gameId, system || "PS2");
  });

  ipcMain.handle("clear-artwork-cache", async () => clearArtworkCache());

  ipcMain.handle("open-art-folder", async (_event, root: string) => {
    const artDir = path.join(requireLibraryRoot(root), "ART");
    const error = await shell.openPath(artDir);
    return { success: !error, message: error };
  });

  ipcMain.handle("import-artwork-manual", async (_event, root: string, gameIdValue: string) => {
    const oplRoot = requireLibraryRoot(root);
    const gameId = requireGameId(gameIdValue);
    const chosen = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }] });
    if (chosen.canceled || !chosen.filePaths[0]) return { success: false, cancelled: true };
    const source = chosen.filePaths[0];
    if (!(await isValidImageFile(source))) throw new Error("Selected file is not a valid image");
    const sourceName = path.basename(source);
    const destinationName = sourceName.startsWith(`${gameId}_`) ? sourceName : `${gameId}_${sourceName}`;
    const destination = path.join(oplRoot, "ART", destinationName);
    await safeCopyFile(source, destination, { verifySha256: true });
    return { success: true, path: destination };
  });
}
