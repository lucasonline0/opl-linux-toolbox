import { ipcMain } from "electron";
import { requireLibraryRoot } from "../services/library-registry";
import { scanMaintenance, repairMaintenanceIssue } from "../services/maintenance.service";

export function registerMaintenanceIpc(): void {
  ipcMain.handle("maintenance-scan", async (_event, root: string) => scanMaintenance(requireLibraryRoot(root)));
  ipcMain.handle("maintenance-repair", async (_event, root: string, issueId: string) => {
    if (typeof issueId !== "string" || issueId.length > 300) throw new Error("Invalid issue ID");
    return repairMaintenanceIssue(requireLibraryRoot(root), issueId);
  });
}
