import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import path from "path";

const execFileAsync = promisify(execFile);

export interface StorageInfo {
  name: string;
  mountpoint: string;
  source: string;
  filesystem: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  removable: boolean;
  connected: boolean;
}

interface LsblkNode {
  name?: string; label?: string; model?: string; path?: string; fstype?: string;
  mountpoint?: string | null; mountpoints?: Array<string | null>; size?: number | string;
  rm?: boolean | number; hotplug?: boolean | number; children?: LsblkNode[];
}

function flatten(nodes: LsblkNode[], parent?: LsblkNode): Array<{ node: LsblkNode; parent?: LsblkNode }> {
  return nodes.flatMap((node) => [{ node, parent }, ...flatten(node.children || [], node)]);
}

async function diskUsage(mountpoint: string): Promise<{ totalBytes: number; freeBytes: number; usedBytes: number }> {
  const stats = await fs.statfs(mountpoint);
  const totalBytes = stats.blocks * stats.bsize;
  const freeBytes = stats.bavail * stats.bsize;
  return { totalBytes, freeBytes, usedBytes: totalBytes - freeBytes };
}

export class LinuxStorageService {
  async discover(): Promise<StorageInfo[]> {
    if (process.platform !== "linux") return [];
    const { stdout } = await execFileAsync("lsblk", ["-J", "-b", "-o", "NAME,PATH,LABEL,MODEL,SIZE,FSTYPE,MOUNTPOINTS,RM,HOTPLUG"], { maxBuffer: 4 * 1024 * 1024 });
    const data = JSON.parse(stdout) as { blockdevices?: LsblkNode[] };
    const result: StorageInfo[] = [];
    for (const { node, parent } of flatten(data.blockdevices || [])) {
      const mountpoint = (node.mountpoints || [node.mountpoint]).find((value): value is string => !!value);
      if (!mountpoint || !node.fstype) continue;
      const usage = await diskUsage(mountpoint).catch(() => ({ totalBytes: Number(node.size) || 0, freeBytes: 0, usedBytes: 0 }));
      result.push({
        name: node.label || parent?.model?.trim() || node.model?.trim() || node.name || "Storage",
        mountpoint,
        source: node.path || `/dev/${node.name}`,
        filesystem: node.fstype,
        ...usage,
        removable: Boolean(node.rm || node.hotplug || parent?.rm || parent?.hotplug),
        connected: true,
      });
    }
    return result;
  }

  async inspect(target: string): Promise<StorageInfo> {
    const resolved = path.resolve(target);
    await fs.access(resolved);
    let source = "";
    let filesystem = "unknown";
    let mountpoint = resolved;
    try {
      const { stdout } = await execFileAsync("findmnt", ["-J", "-T", resolved, "-o", "SOURCE,FSTYPE,TARGET"]);
      const parsed = JSON.parse(stdout) as { filesystems?: Array<{ source?: string; fstype?: string; target?: string }> };
      const found = parsed.filesystems?.[0];
      source = found?.source || "";
      filesystem = found?.fstype || "unknown";
      mountpoint = found?.target || resolved;
    } catch { /* Local or unusual mounted folders still work via statfs. */ }
    const usage = await diskUsage(resolved);
    return {
      name: path.basename(mountpoint) || "OPL Library", mountpoint: resolved, source,
      filesystem, ...usage, removable: source.startsWith("/dev/"), connected: true,
    };
  }

  async unmount(source: string): Promise<{ success: boolean; message: string }> {
    if (process.platform !== "linux" || !/^\/dev\/[a-zA-Z0-9._/-]+$/.test(source)) {
      return { success: false, message: "A block device is required for safe unmount." };
    }
    try {
      const { stdout, stderr } = await execFileAsync("udisksctl", ["unmount", "-b", source]);
      return { success: true, message: (stdout || stderr).trim() };
    } catch (error: any) {
      return { success: false, message: error?.stderr?.trim() || error?.message || String(error) };
    }
  }
}

export const linuxStorage = new LinuxStorageService();
