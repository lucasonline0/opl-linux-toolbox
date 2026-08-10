import * as fs from "fs/promises";
import path from "path";
import { scanUlInstallations, removeUlGame } from "./ul.service";
import { assertPathContained } from "../utils/path-safety";

export interface MaintenanceIssue {
  id: string;
  category: "ul-incomplete" | "ul-orphan" | "ul-duplicate" | "ul-invalid" | "abandoned-part";
  title: string;
  gameId: string | null;
  detail: string;
  files: string[];
  repairable: boolean;
}
export async function scanMaintenance(root: string): Promise<MaintenanceIssue[]> {
  const ul = await scanUlInstallations(root);
  const issues: MaintenanceIssue[] = ul.filter((item) => item.kind !== "complete").map((item, index) => ({
    id: `ul:${item.kind}:${item.gameId || index}`,
    category: item.kind === "incomplete" ? "ul-incomplete" : item.kind === "orphan" ? "ul-orphan" : item.kind === "duplicate" ? "ul-duplicate" : "ul-invalid",
    title: item.title,
    gameId: item.gameId,
    detail: item.detail,
    files: item.files.map((file) => path.relative(root, file)),
    repairable: (item.kind === "incomplete" || item.kind === "orphan") && !!item.gameId,
  }));
  for (const folder of ["CD", "DVD", "ART", "VCD", "POPS", "APPS"]) {
    const directory = path.join(root, folder);
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.startsWith(".") || !entry.name.endsWith(".part")) continue;
      issues.push({
        id: `part:${folder}:${entry.name}`,
        category: "abandoned-part",
        title: "Abandoned partial file",
        gameId: null,
        detail: `${folder}/${entry.name}`,
        files: [`${folder}/${entry.name}`],
        repairable: true,
      });
    }
  }
  return issues;
}

export async function repairMaintenanceIssue(root: string, issueId: string) {
  const issues = await scanMaintenance(root);
  const issue = issues.find((item) => item.id === issueId);
  if (!issue || !issue.repairable) throw new Error("Maintenance issue is not repairable");
  if ((issue.category === "ul-incomplete" || issue.category === "ul-orphan") && issue.gameId) {
    return { success: true, ...(await removeUlGame(root, issue.gameId)) };
  }
  if (issue.category === "abandoned-part") {
    const target = assertPathContained(root, path.join(root, issue.files[0]));
    if (!path.basename(target).startsWith(".") || !target.endsWith(".part")) throw new Error("Unsafe partial-file target");
    await fs.unlink(target);
    return { success: true, removed: [target] };
  }
  throw new Error("Unsupported repair operation");
}
