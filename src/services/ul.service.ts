import * as fs from "fs/promises";
import path from "path";
import { app } from "electron";
import { normalizeGameId, requireGameId } from "../utils/game-id";
import { assertPathContained } from "../utils/path-safety";

export const UL_RECORD_SIZE = 64;
const CHUNK_RE = /^ul\.[0-9a-f]{8}\.([a-z0-9]{4}[_-]\d{3}\.\d{2})\.(\d{2})$/i;

export interface UlRecord {
  index: number;
  raw: Buffer;
  title: string;
  imageName: string;
  gameId: string | null;
  parts: number;
  media: "CD" | "DVD" | "unknown";
  valid: boolean;
}
export interface ParsedUlCfg {
  records: UlRecord[];
  trailingBytes: Buffer;
  originalBytes: Buffer;
}

export type UlIssueKind = "incomplete" | "orphan" | "duplicate" | "invalid";
export interface UlScanEntry {
  kind: UlIssueKind | "complete";
  gameId: string | null;
  title: string;
  expectedParts: number;
  presentParts: number[];
  missingParts: number[];
  files: string[];
  recordIndexes: number[];
  detail: string;
}

function cstring(value: Buffer): string {
  const end = value.indexOf(0);
  return value.subarray(0, end < 0 ? value.length : end).toString("utf8").trim();
}

export function parseUlCfgBytes(data: Buffer): ParsedUlCfg {
  const completeLength = data.length - (data.length % UL_RECORD_SIZE);
  const records: UlRecord[] = [];
  for (let offset = 0; offset < completeLength; offset += UL_RECORD_SIZE) {
    const raw = Buffer.from(data.subarray(offset, offset + UL_RECORD_SIZE));
    const title = cstring(raw.subarray(0, 32));
    const imageName = cstring(raw.subarray(32, 47));
    const gameId = normalizeGameId(imageName.replace(/^ul[._-]?/i, ""));
    const parts = raw[47];
    const mediaByte = raw[48];
    records.push({
      index: offset / UL_RECORD_SIZE,
      raw,
      title,
      imageName,
      gameId,
      parts,
      media: mediaByte === 0x12 ? "CD" : mediaByte === 0x14 ? "DVD" : "unknown",
      valid: !!title && !!gameId && parts > 0,
    });
  }
  return {
    records,
    trailingBytes: Buffer.from(data.subarray(completeLength)),
    originalBytes: Buffer.from(data),
  };
}

export async function readUlCfg(root: string): Promise<ParsedUlCfg> {
  const cfgPath = path.join(root, "ul.cfg");
  const bytes = await fs.readFile(cfgPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return Buffer.alloc(0);
    throw error;
  });
  return parseUlCfgBytes(bytes);
}

export async function scanUlInstallations(root: string): Promise<UlScanEntry[]> {
  const parsed = await readUlCfg(root);
  const files = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const chunks = new Map<string, Array<{ part: number; path: string }>>();
  for (const file of files) {
    if (!file.isFile()) continue;
    const match = file.name.match(CHUNK_RE);
    const id = match && normalizeGameId(match[1]);
    if (!match || !id) continue;
    const values = chunks.get(id) ?? [];
    values.push({ part: Number(match[2]), path: path.join(root, file.name) });
    chunks.set(id, values);
  }
  const byId = new Map<string, UlRecord[]>();
  const result: UlScanEntry[] = [];
  for (const record of parsed.records) {
    if (!record.valid || !record.gameId) {
      result.push({
        kind: "invalid", gameId: record.gameId, title: record.title || "Invalid entry",
        expectedParts: record.parts, presentParts: [], missingParts: [], files: [],
        recordIndexes: [record.index], detail: "ul.cfg contains an invalid 64-byte record",
      });
      continue;
    }
    const group = byId.get(record.gameId) ?? [];
    group.push(record);
    byId.set(record.gameId, group);
  }
  for (const [gameId, records] of byId) {
    const record = records[0];
    const found = (chunks.get(gameId) ?? []).sort((a, b) => a.part - b.part);
    const present = [...new Set(found.map((item) => item.part))];
    const expected = Array.from({ length: record.parts }, (_, index) => index);
    const missing = expected.filter((part) => !present.includes(part));
    const duplicate = records.length > 1;
    result.push({
      kind: duplicate ? "duplicate" : missing.length ? "incomplete" : "complete",
      gameId,
      title: record.title,
      expectedParts: record.parts,
      presentParts: present,
      missingParts: missing,
      files: found.map((item) => item.path),
      recordIndexes: records.map((item) => item.index),
      detail: duplicate
        ? `${records.length} ul.cfg records use the same game ID`
        : missing.length
          ? `${found.length} chunks found; missing ${missing.map((n) => n.toString().padStart(2, "0")).join(", ")}`
          : `${found.length}/${record.parts} chunks present`,
    });
    chunks.delete(gameId);
  }
  for (const [gameId, found] of chunks) {
    found.sort((a, b) => a.part - b.part);
    result.push({
      kind: "orphan", gameId, title: `Interrupted installation (${gameId})`, expectedParts: 0,
      presentParts: found.map((item) => item.part), missingParts: [], files: found.map((item) => item.path),
      recordIndexes: [], detail: `${found.length} chunk(s) exist without a ul.cfg record`,
    });
  }
  return result;
}

function backupDirectory(): string {
  try {
    return path.join(app.getPath("userData"), "ul-backups");
  } catch {
    return path.join(process.env.XDG_DATA_HOME || path.join(process.env.HOME || ".", ".local", "share"), "opl-linux-toolbox", "ul-backups");
  }
}

export async function backupUlCfg(root: string): Promise<string | null> {
  const cfgPath = path.join(root, "ul.cfg");
  const bytes = await fs.readFile(cfgPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!bytes) return null;
  const dir = backupDirectory();
  await fs.mkdir(dir, { recursive: true });
  const safeRoot = path.basename(path.resolve(root)).replace(/[^a-z0-9._-]+/gi, "_");
  const name = `${safeRoot}-${new Date().toISOString().replace(/[:.]/g, "-")}-ul.cfg`;
  const destination = path.join(dir, name);
  await fs.writeFile(destination, bytes, { flag: "wx" });
  return destination;
}

export async function removeUlGame(root: string, rawGameId: string): Promise<{ backup: string | null; removed: string[] }> {
  const gameId = requireGameId(rawGameId);
  const parsed = await readUlCfg(root);
  const scan = await scanUlInstallations(root);
  const target = scan.filter((item) => item.gameId === gameId);
  const removed: string[] = [];
  const backup = await backupUlCfg(root);
  const kept = parsed.records.filter((record) => record.gameId !== gameId).map((record) => record.raw);
  const cfgPath = path.join(root, "ul.cfg");
  const temp = path.join(root, ".ul.cfg.opl-toolbox.part");
  await fs.writeFile(temp, Buffer.concat([...kept, parsed.trailingBytes]));
  const handle = await fs.open(temp, "r");
  await handle.sync();
  await handle.close();
  await fs.rename(temp, cfgPath);
  for (const entry of target) {
    for (const file of entry.files) {
      const safe = assertPathContained(root, file);
      if (path.basename(safe).match(CHUNK_RE)) {
        await fs.unlink(safe).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") throw error;
        });
        removed.push(safe);
      }
    }
  }
  return { backup, removed };
}

export interface UlSnapshot { cfg: Buffer | null; files: Set<string> }
export async function snapshotUl(root: string): Promise<UlSnapshot> {
  const cfg = await fs.readFile(path.join(root, "ul.cfg")).catch((error: NodeJS.ErrnoException) => error.code === "ENOENT" ? null : Promise.reject(error));
  const files = new Set((await fs.readdir(root)).filter((name) => name.startsWith("ul.")));
  return { cfg, files };
}

export async function rollbackUl(root: string, snapshot: UlSnapshot): Promise<string[]> {
  const current = (await fs.readdir(root)).filter((name) => name.startsWith("ul."));
  const removed: string[] = [];
  for (const name of current) {
    if (snapshot.files.has(name)) continue;
    const target = assertPathContained(root, path.join(root, name));
    await fs.unlink(target).catch(() => undefined);
    removed.push(target);
  }
  const cfgPath = path.join(root, "ul.cfg");
  if (snapshot.cfg === null) await fs.unlink(cfgPath).catch(() => undefined);
  else await fs.writeFile(cfgPath, snapshot.cfg);
  return removed;
}
