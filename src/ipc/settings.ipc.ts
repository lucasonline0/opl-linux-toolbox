import { ipcMain } from "electron";
import {
  AppSettings,
  getSettings,
  setSetting,
  directoryExists,
} from "../services/settings.service";
import { checkForUpdates } from "../services/update.service";

export function registerSettingsIpc(): void {
  ipcMain.handle("get-settings", async () => {
    return getSettings();
  });

  ipcMain.handle(
    "set-setting",
    async <K extends keyof AppSettings>(
      _event: unknown,
      key: K,
      value: AppSettings[K]
    ) => {
      const allowed = new Set<keyof AppSettings>([
        "lastDirectory", "autoReconnect", "autoArtwork", "downloadAllArtwork",
        "verifySha256", "confirmDestructiveActions", "theme", "animations", "density", "accent",
        "glassIntensity", "cornerRadius",
      ]);
      if (!allowed.has(key)) throw new Error("Unknown or read-only setting");
      return setSetting(key, value);
    }
  );

  ipcMain.handle("directory-exists", async (_event, dirPath: string) => {
    return directoryExists(dirPath);
  });

  ipcMain.handle("check-for-updates", async () => {
    return checkForUpdates();
  });
}
