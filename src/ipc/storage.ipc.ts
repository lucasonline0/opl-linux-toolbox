import { ipcMain } from "electron";
import { linuxStorage } from "../services/linux-storage.service";
import { registerLibraryRoot, requireLibraryRoot, unregisterLibraryRoot } from "../services/library-registry";

const knownDevices = new Set<string>();

export function registerStorageIpc(): void {
  ipcMain.handle("storage-discover", async () => {
    const devices = await linuxStorage.discover();
    for (const device of devices) if (device.source) knownDevices.add(device.source);
    return devices;
  });
  ipcMain.handle("storage-inspect", async (_event, root: string) => {
    const info = await linuxStorage.inspect(root);
    registerLibraryRoot(root);
    if (info.source) knownDevices.add(info.source);
    return info;
  });
  ipcMain.handle("storage-unmount", async (_event, root: string) => {
    const registered = requireLibraryRoot(root);
    const info = await linuxStorage.inspect(registered);
    if (!knownDevices.has(info.source)) throw new Error("Unknown storage device");
    const result = await linuxStorage.unmount(info.source);
    if (result.success) unregisterLibraryRoot(root);
    return result;
  });
}
