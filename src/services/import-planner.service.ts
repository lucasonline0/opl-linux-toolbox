import * as fs from "fs/promises";
import path from "path";
import { linuxStorage } from "./linux-storage.service";

export const FAT32_MAX_FILE_BYTES = 4_294_967_295;

export interface ImportPlan {
  sourcePath: string;
  sizeBytes: number;
  filesystem: string;
  destinationFormat: "ISO" | "ZSO" | "UL";
  strategy: "direct-copy" | "iso2opl" | "zso-to-ul";
  destinationDirectory: "DVD" | "CD";
  methodLabel: string;
  warning?: string;
}

export function chooseImportStrategy(filesystemValue: string, sizeBytes: number, sourceFormat: "ISO" | "ZSO") {
  const filesystem = filesystemValue.toLowerCase();
  const fat32 = ["vfat", "fat", "fat32", "msdos"].includes(filesystem);
  if (fat32 && sizeBytes > FAT32_MAX_FILE_BYTES) {
    return { destinationFormat: "UL" as const, strategy: sourceFormat === "ZSO" ? "zso-to-ul" as const : "iso2opl" as const };
  }
  return { destinationFormat: sourceFormat, strategy: "direct-copy" as const };
}

export async function planPs2Import(sourcePath: string, oplRoot: string, media: "DVD" | "CD" = "DVD"): Promise<ImportPlan> {
  const stat = await fs.stat(sourcePath);
  if (!stat.isFile() || stat.size === 0) throw new Error("Source must be a non-empty file");
  const storage = await linuxStorage.inspect(oplRoot);
  const filesystem = storage.filesystem.toLowerCase();
  const sourceFormat = path.extname(sourcePath).toLowerCase() === ".zso" ? "ZSO" : "ISO";
  const selected = chooseImportStrategy(filesystem, stat.size, sourceFormat);
  if (selected.strategy !== "direct-copy") {
    return {
      sourcePath, sizeBytes: stat.size, filesystem: storage.filesystem, destinationFormat: "UL",
      strategy: selected.strategy, destinationDirectory: media,
      methodLabel: sourceFormat === "ZSO" ? "Decompressão temporária + USBExtreme / UL" : "Conversão necessária (USBExtreme / UL)",
    };
  }
  return {
    sourcePath, sizeBytes: stat.size, filesystem: storage.filesystem, destinationFormat: sourceFormat,
    strategy: "direct-copy", destinationDirectory: media, methodLabel: `${sourceFormat} · cópia direta segura`,
    warning: filesystem === "unknown" ? "Filesystem desconhecido; espaço e escrita serão validados antes da cópia." : undefined,
  };
}
