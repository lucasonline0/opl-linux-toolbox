import { ipcMain, shell } from "electron";
import {
  openAskDirectory,
  openAskGameFiles,
  openAskElfFiles,
} from "../services/library.service";

export function registerDialogIpc(): void {
  ipcMain.handle("open-ask-directory", async (options) => {
    return openAskDirectory(options);
  });

  ipcMain.handle(
    "open-ask-game-files",
    async (_event, isGameCd: boolean, isGameDvd: boolean) => {
      return openAskGameFiles(isGameCd, isGameDvd);
    }
  );

  ipcMain.handle("open-ask-elf-files", async () => {
    return openAskElfFiles();
  });

  ipcMain.handle("open-external", async (_event, url: string) => {
    if (/^https:\/\//i.test(url)) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  });
}
