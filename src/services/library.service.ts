import { dialog } from "electron";
import * as fs from "fs/promises";
import path from "path";
import { createLogger, formatBytes } from "../logger";
import { isDirectoryEntry } from "../utils/fs-entry";
import { artworkUrl } from "./art-url.service";

const log = createLogger("library");

export async function openAskDirectory(options: any) {
  const defaultOptions = {
    properties: ["openDirectory"],
    title: "Select OPL Root Directory",
  };

  const result = await dialog.showOpenDialog({
    ...defaultOptions,
    ...options,
  });

  return result;
}

// Standard OPL folder structure this toolbox manages.
export const STANDARD_OPL_DIRS = [
  "APPS",
  "ART",
  "CD",
  "CFG",
  "DVD",
  "POPS",
  "VCD",
  "VMC",
];

export async function checkOplStructure(dirPath: string) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const standard = new Set<string>(STANDARD_OPL_DIRS);
    const dirNames = new Set<string>();
    await Promise.all(
      entries.map(async (e) => {
        if (standard.has(e.name) && (await isDirectoryEntry(e, dirPath))) {
          dirNames.add(e.name);
        }
      })
    );
    const existing = STANDARD_OPL_DIRS.filter((d) => dirNames.has(d));
    const missing = STANDARD_OPL_DIRS.filter((d) => !dirNames.has(d));
    log.verbose(
      `OPL structure check for ${dirPath} — present: [${existing.join(", ")}], ` +
        `missing: [${missing.join(", ")}]`
    );
    return { success: true, existing, missing };
  } catch (err) {
    log.error(`Failed to check OPL structure in ${dirPath}:`, err);
    return { success: false, message: String(err) };
  }
}

export async function createOplFolders(dirPath: string, folders: string[]) {
  try {
    const created: string[] = [];
    for (const folder of folders) {
      if (!STANDARD_OPL_DIRS.includes(folder)) continue;
      await fs.mkdir(path.join(dirPath, folder), { recursive: true });
      created.push(folder);
    }
    log.info(`Created OPL folder(s) under ${dirPath}: [${created.join(", ")}]`);
    return { success: true, created };
  } catch (err) {
    log.error(`Failed to create OPL folders in ${dirPath}:`, err);
    return { success: false, message: String(err) };
  }
}

export async function getGamesFiles(dirPath: string) {
  try {
    log.verbose(`Scanning game folders under ${dirPath} (CD, DVD, VCD, POPS)`);
    const [items_cd, items_dvd, items_vcd, items_pops] = await Promise.all([
      fs.readdir(path.join(dirPath, "CD"), { withFileTypes: true }).catch(() => []),
      fs.readdir(path.join(dirPath, "DVD"), { withFileTypes: true }).catch(() => []),
      fs.readdir(path.join(dirPath, "VCD"), { withFileTypes: true }).catch(() => []),
      fs.readdir(path.join(dirPath, "POPS"), { withFileTypes: true }).catch(() => []),
    ]);
    log.verbose(
      `Raw directory entries — CD: ${items_cd.length}, DVD: ${items_dvd.length}, ` +
        `VCD: ${items_vcd.length}, POPS: ${items_pops.length}`
    );
    const items = [
      ...items_cd.map((item) =>
        Object.assign(item, { parentDir: path.join(dirPath, "CD") })
      ),
      ...items_dvd.map((item) =>
        Object.assign(item, { parentDir: path.join(dirPath, "DVD") })
      ),
      ...items_vcd.map((item) =>
        Object.assign(item, { parentDir: path.join(dirPath, "VCD") })
      ),
      ...items_pops.map((item) =>
        Object.assign(item, { parentDir: path.join(dirPath, "POPS") })
      ),
    ].filter((item) => {
      if (item.name.startsWith(".")) return false;
      const lower = item.name.toLowerCase();
      return (
        lower.endsWith(".iso") ||
        lower.endsWith(".zso") ||
        lower.endsWith(".vcd")
      );
    });

    const files = [];

    for (const item of items) {
      const fullPath = path.join(item.parentDir, item.name);
      let stats;
      try {
        stats = await fs.stat(fullPath);
      } catch (err) {
        log.verbose(`Skipping unreadable entry ${fullPath}: ${(err as Error)?.message || err}`);
        continue;
      }
      if (!stats.isFile()) continue;

      const itemInfo = {
        extension: path.extname(item.name),
        name: path.parse(item.name).name,
        parentPath: item.parentDir,
        path: fullPath,
        stats,
      };

      files.push(itemInfo);
    }
    log.info(`Found ${files.length} disc image file(s) under ${dirPath}`);
    return { success: true, data: files };
  } catch (err) {
    log.error(`Failed to scan game files in ${dirPath}:`, err);
    return { success: false, message: err };
  }
}

export async function getULGames(dirPath: string) {
  try {
    const ulCfgPath = path.join(dirPath, "ul.cfg");

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(ulCfgPath);
    } catch (err: any) {
      if (err?.code === "ENOENT" || err?.code === "EACCES" || err?.code === "EPERM") {
        log.verbose(`No readable ul.cfg in ${dirPath} — no UL (split) games present`);
        return { success: true, data: [] };
      }
      throw err;
    }
    const RECORD_SIZE = 64;

    if (buffer.length === 0) {
      log.verbose("ul.cfg is empty — no UL games to parse");
      return { success: true, data: [] };
    }

    const recordCount = Math.floor(buffer.length / RECORD_SIZE);
    log.verbose(`Parsing ul.cfg: ${buffer.length} bytes → ${recordCount} record(s)`);
    const entries: {
      name: string;
      gameId: string;
      numParts: number;
      mediaType: string;
      totalSize: number;
    }[] = [];

    const rootFiles = await fs
      .readdir(dirPath, { withFileTypes: true })
      .catch(() => []);
    const ulFiles = rootFiles.filter((f) => f.name.startsWith("ul."));

    const { crc32 } = await import("../utils/crc32");

    for (let i = 0; i < recordCount; i++) {
      const offset = i * RECORD_SIZE;
      const record = buffer.subarray(offset, offset + RECORD_SIZE);

      const nameRaw = record.subarray(0, 32);
      const nameEnd = nameRaw.indexOf(0);
      const name = nameRaw
        .subarray(0, nameEnd === -1 ? 32 : nameEnd)
        .toString("ascii")
        .trim();

      const idRaw = record.subarray(32, 47);
      const idEnd = idRaw.indexOf(0);
      const gameIdRaw = idRaw
        .subarray(0, idEnd === -1 ? 15 : idEnd)
        .toString("ascii")
        .trim();

      if (!name || !gameIdRaw) {
        continue;
      }

      let normalized = gameIdRaw.trim();
      normalized = normalized.replace(/^ul[._-]?/i, "");
      const cleaned = normalized.replace(/[^A-Za-z0-9]/g, "");
      const idMatch = cleaned.match(/^([A-Za-z]{4})(\d{5})$/);
      const gameId = idMatch
        ? `${idMatch[1].toUpperCase()}_${idMatch[2].slice(0, 3)}.${idMatch[2].slice(3)}`
        : normalized;

      const numParts = record[47];

      const mediaTypeRaw = record.readUInt32LE(48);
      const mediaType = mediaTypeRaw === 0x12 ? "CD" : "DVD";

      const hash = crc32(name).toString(16).padStart(8, "0").toUpperCase();
      const prefixByCrc = `UL.${hash}`;

      const gameIdNoDot = gameId.replace(/\./g, "").toUpperCase();
      const prefixById = `UL.${gameIdNoDot}`;

      let totalSize = 0;
      for (const f of ulFiles) {
        const upperName = f.name.toUpperCase();
        if (upperName.startsWith(prefixByCrc) || upperName.startsWith(prefixById)) {
          try {
            const stat = await fs.stat(path.join(dirPath, f.name));
            totalSize += stat.size;
          } catch {
            // Fragment file inaccessible, skip
          }
        }
      }

      log.verbose(
        `UL entry: ${gameId} "${name}" — ${numParts} part(s), ${mediaType}, ${formatBytes(totalSize)}`
      );
      entries.push({ name, gameId, numParts, mediaType, totalSize });
    }

    if (entries.length > 0) {
      log.info(`Parsed ${entries.length} UL (split) game(s) from ul.cfg`);
    }
    return { success: true, data: entries };
  } catch (err) {
    log.error(`Failed to read UL games from ${dirPath}:`, err);
    return { success: false, message: err };
  }
}

export async function getArtFolder(dirpath: string) {
  try {
    const artDir = path.join(dirpath, "ART");
    const items = await fs.readdir(artDir, { withFileTypes: true });
    const artFiles = (
      await Promise.all(
        items
          .filter(
            (item) =>
              !item.name.startsWith(".") &&
              (item.name.toLowerCase().endsWith(".jpg") ||
                item.name.toLowerCase().endsWith(".png"))
          )
          .map(async (item) => {
            const filePath = path.join(artDir, item.name);
            const baseName = path.parse(item.name).name;
            const idMatch = baseName.match(/^([A-Z0-9]{4}_\d{3}\.\d{2})_/i);
            const gameId = idMatch ? idMatch[1].toUpperCase() : baseName;
            // Preserve compound remote types (BG_00, SCR_01, etc.) instead of
            // truncating them to the final numeric suffix.
            const type = idMatch ? baseName.slice(idMatch[0].length) : "";
            return {
              name: baseName,
              extension: path.extname(item.name),
              path: filePath,
              gameId,
              type,
              base64: "",
              url: artworkUrl(filePath),
            };
          })
      )
    ).filter((f): f is NonNullable<typeof f> => f !== null);
    log.verbose(`Loaded ${artFiles.length} artwork file(s) from ${artDir}`);
    return { success: true, data: artFiles };
  } catch (err) {
    log.verbose(`No artwork loaded from ${path.join(dirpath, "ART")}: ${(err as Error)?.message || err}`);
    return { success: false, message: err };
  }
}

export async function renameGamefile(
  dirpath: string,
  gameId: string,
  gameName: string,
  nameOnly: boolean = false
) {
  const { sanitizeGameFilename } = await import("../utils/sanitize");
  const ext = path.extname(dirpath);
  const parentDir = path.dirname(dirpath);
  const safeName = sanitizeGameFilename(gameName);
  const newFileName = nameOnly
    ? `${safeName}${ext}`
    : `${gameId}.${safeName}${ext}`;
  const newFilePath = path.join(parentDir, newFileName);

  log.verbose(
    `Renaming (${nameOnly ? "new" : "old"} convention): ${path.basename(dirpath)} → ${newFileName}`
  );

  try {
    await fs.rename(dirpath, newFilePath);
    log.info(`Renamed ${gameId} → ${newFileName}`);
    return { success: true, newPath: newFilePath };
  } catch (err) {
    log.error(`Failed to rename ${path.basename(dirpath)} → ${newFileName}:`, err);
    return { success: false, message: err };
  }
}

export async function openAskElfFiles() {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "PS2 ELF / Homebrew", extensions: ["elf", "ELF"] }],
    title: "Select homebrew ELF(s) to import",
  });
  return result;
}

export async function openAskGameFiles(
  isGameCd: boolean,
  isGameDvd: boolean
) {
  const filters = [];
  if (isGameCd) {
    filters.push({ name: "CUE Files", extensions: ["cue"] });
  }
  if (isGameDvd) {
    filters.push({ name: "ISO/ZSO Files", extensions: ["iso", "zso"] });
  }
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters,
    title: "Select Game Files to Import",
  });

  return result;
}

export async function moveFile(
  sourcePath: string,
  destPath: string,
  onProgress?: (progress: {
    percent: number;
    copiedMB: number;
    totalMB: number;
    elapsed: number;
  }) => void
) {
  const fsSync = await import("fs");

  log.info(`Moving file: ${sourcePath} → ${destPath}`);

  let targetPath = destPath;

  try {
    const destStats = await fs.stat(destPath);
    if (destStats.isDirectory()) {
      targetPath = path.join(destPath, path.basename(sourcePath));
    }
  } catch (statErr: any) {
    if (statErr?.code !== "ENOENT") {
      return { success: false, message: statErr?.message || String(statErr) };
    }
  }

  try {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
  } catch (mkdirErr: any) {
    if (mkdirErr?.code !== "EEXIST") {
      return { success: false, message: mkdirErr?.message || String(mkdirErr) };
    }
  }

  try {
    await fs.rename(sourcePath, targetPath);
    log.verbose(`Moved instantly via rename (same volume) → ${targetPath}`);
    return { success: true, newPath: targetPath };
  } catch (err: any) {
    if (err?.code === "EXDEV") {
      try {
        log.verbose("Cross-device move (EXDEV) — falling back to streamed copy");
        const stats = await fs.stat(sourcePath);
        const totalSize = stats.size;
        const startTime = Date.now();

        await new Promise<void>((resolve, reject) => {
          const readStream = fsSync.createReadStream(sourcePath);
          const writeStream = fsSync.createWriteStream(targetPath);

          let copiedBytes = 0;
          let lastLogTime = Date.now();
          const LOG_INTERVAL_MS = 1000;

          readStream.on("data", (chunk: string | Buffer) => {
            copiedBytes += Buffer.isBuffer(chunk)
              ? chunk.length
              : Buffer.byteLength(chunk);
            const now = Date.now();

            if (now - lastLogTime >= LOG_INTERVAL_MS) {
              const progress = ((copiedBytes / totalSize) * 100).toFixed(1);
              const copiedMB = (copiedBytes / (1024 * 1024)).toFixed(2);
              const totalMB = (totalSize / (1024 * 1024)).toFixed(2);
              const elapsed = ((now - startTime) / 1000).toFixed(1);
              log.verbose(
                `Copy progress: ${progress}% (${copiedMB}/${totalMB} MB) — ${elapsed}s elapsed`
              );

              if (onProgress) {
                onProgress({
                  percent: parseFloat(progress),
                  copiedMB: parseFloat(copiedMB),
                  totalMB: parseFloat(totalMB),
                  elapsed: parseFloat(elapsed),
                });
              }

              lastLogTime = now;
            }
          });

          readStream.on("error", reject);
          writeStream.on("error", reject);
          writeStream.on("finish", resolve);

          readStream.pipe(writeStream);
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        log.info(`Copied ${formatBytes(totalSize)} in ${duration}s → ${targetPath}`);
        return { success: true, newPath: targetPath };
      } catch (copyErr: any) {
        log.error(`Cross-device copy failed (${sourcePath}):`, copyErr?.message || copyErr);
        return { success: false, message: copyErr?.message || String(copyErr) };
      }
    }
    log.error(`Failed to move ${sourcePath} → ${targetPath}:`, err?.message || err);
    return { success: false, message: err?.message || String(err) };
  }
}
