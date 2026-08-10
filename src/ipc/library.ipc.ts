import { ipcMain } from "electron";
import {
  getGamesFiles,
  getULGames,
  getArtFolder,
  checkOplStructure,
  createOplFolders,
  renameGamefile,
} from "../services/library.service";
import {
  resolveIsoGameId,
  tryDetermineGameIdFromHex,
  tryDeterminePs1GameIdFromHex,
  tryDeterminePs1GameIdFromVcd,
} from "../services/game-id-resolver.service";
import { registerLibraryRoot } from "../services/library-registry";

export function registerLibraryIpc(): void {
  ipcMain.handle("get-games-files", async (_event, dirPath: string) => {
    registerLibraryRoot(dirPath);
    return getGamesFiles(dirPath);
  });

  ipcMain.handle("get-ul-games", async (_event, dirPath: string) => {
    return getULGames(dirPath);
  });

  ipcMain.handle("get-art-folder", async (_event, dirPath: string) => {
    return getArtFolder(dirPath);
  });

  ipcMain.handle("check-opl-structure", async (_event, dirPath: string) => {
    registerLibraryRoot(dirPath);
    return checkOplStructure(dirPath);
  });

  ipcMain.handle(
    "create-opl-folders",
    async (_event, dirPath: string, folders: string[]) => {
      return createOplFolders(dirPath, folders);
    }
  );

  ipcMain.handle(
    "rename-gamefile",
    async (
      _event,
      dirPath: string,
      gameId: string,
      gameName: string,
      nameOnly?: boolean
    ) => {
      return renameGamefile(dirPath, gameId, gameName, !!nameOnly);
    }
  );

  ipcMain.handle("resolve-iso-gameid", async (_event, filepath: string) => {
    return resolveIsoGameId(filepath);
  });

  ipcMain.handle(
    "try-determine-gameid-from-hex",
    async (_event, filepath: string) => {
      return tryDetermineGameIdFromHex(filepath);
    }
  );

  ipcMain.handle(
    "try-determine-ps1-gameid-from-hex",
    async (_event, filepath: string) => {
      return tryDeterminePs1GameIdFromHex(filepath);
    }
  );

  ipcMain.handle("try-determine-ps1-gameid-from-vcd", async (_event, filepath: string) => {
    return tryDeterminePs1GameIdFromVcd(filepath);
  });

}
