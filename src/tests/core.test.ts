import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs/promises";
import path from "path";
import os from "os";
import { parseUlCfgBytes, scanUlInstallations, snapshotUl, rollbackUl } from "../services/ul.service";
import { isPathContained, assertPathContained } from "../utils/path-safety";
import { safeCopyFile } from "../services/safe-copy.service";
import { normalizeGameId } from "../utils/game-id";
import { ArtDatabaseService } from "../services/artwork.service";
import { chooseImportStrategy, FAT32_MAX_FILE_BYTES } from "../services/import-planner.service";
import { deleteGameAndRelatedFiles } from "../services/delete.service";

function ulRecord(title: string, gameId: string, parts: number): Buffer {
  const result = Buffer.alloc(64);
  result.write(title.slice(0, 31), 0, "utf8");
  result.write(`ul.${gameId}`, 32, "ascii");
  result[47] = parts;
  result[48] = 0x14;
  return result;
}

async function fixture(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "opl-core-test-"));
}

test("parse ul.cfg uses 64-byte records and preserves unknown/trailing bytes", () => {
  const first = ulRecord("Game One", "SCUS_974.81", 2);
  first[63] = 0xa5;
  const trailing = Buffer.from([1, 2, 3, 4, 5]);
  const parsed = parseUlCfgBytes(Buffer.concat([first, trailing]));
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].gameId, "SCUS_974.81");
  assert.equal(parsed.records[0].raw[63], 0xa5);
  assert.deepEqual(parsed.trailingBytes, trailing);
});

test("UL scanner detects complete, missing chunks and orphan chunks", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "ul.cfg"), Buffer.concat([
    ulRecord("Complete", "SCUS_974.81", 2),
    ulRecord("Missing", "SCES_539.25", 3),
  ]));
  for (const name of [
    "ul.11111111.SCUS_974.81.00", "ul.11111111.SCUS_974.81.01",
    "ul.22222222.SCES_539.25.00", "ul.22222222.SCES_539.25.02",
    "ul.33333333.SCES_539.29.00",
  ]) await fs.writeFile(path.join(root, name), "chunk");
  const scan = await scanUlInstallations(root);
  assert.equal(scan.find((item) => item.gameId === "SCUS_974.81")?.kind, "complete");
  const missing = scan.find((item) => item.gameId === "SCES_539.25");
  assert.equal(missing?.kind, "incomplete");
  assert.deepEqual(missing?.missingParts, [1]);
  assert.equal(scan.find((item) => item.gameId === "SCES_539.29")?.kind, "orphan");
});

test("UL rollback restores ul.cfg byte-for-byte and removes only new chunks", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const original = Buffer.concat([ulRecord("Existing", "SCUS_974.81", 1), Buffer.from([9, 8, 7])]);
  const existingChunk = "ul.11111111.SCUS_974.81.00";
  await fs.writeFile(path.join(root, "ul.cfg"), original);
  await fs.writeFile(path.join(root, existingChunk), "existing");
  const before = await snapshotUl(root);
  const newChunk = "ul.22222222.SCES_539.25.00";
  await fs.writeFile(path.join(root, "ul.cfg"), Buffer.from("corrupt"));
  await fs.writeFile(path.join(root, newChunk), "partial");
  await rollbackUl(root, before);
  assert.deepEqual(await fs.readFile(path.join(root, "ul.cfg")), original);
  assert.equal(await fs.readFile(path.join(root, existingChunk), "utf8"), "existing");
  await assert.rejects(fs.access(path.join(root, newChunk)));
});

test("path containment blocks traversal and prefix collisions", () => {
  assert.equal(isPathContained("/media/opl", "/media/opl/DVD/game.iso"), true);
  assert.equal(isPathContained("/media/opl", "/media/opl-evil/game.iso"), false);
  assert.equal(isPathContained("/media/opl", "/media/opl/../secret"), false);
  assert.throws(() => assertPathContained("/media/opl", "/etc/passwd"));
});

test("safe direct copy uses .part, verifies, preserves source, and atomically renames", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, "source.iso");
  const destinationDir = path.join(root, "DVD");
  const destination = path.join(destinationDir, "SCUS_974.81.Test.iso");
  await fs.writeFile(source, Buffer.alloc(2 * 1024 * 1024, 0x5a));
  let sawPart = false;
  await safeCopyFile(source, destination, { onProgress: async () => {
    try { await fs.access(path.join(destinationDir, ".SCUS_974.81.Test.iso.part")); sawPart = true; } catch { /* too early */ }
  }});
  assert.equal(sawPart, true);
  assert.deepEqual(await fs.readFile(destination), await fs.readFile(source));
  await fs.access(source);
  await assert.rejects(fs.access(path.join(destinationDir, ".SCUS_974.81.Test.iso.part")));
});

test("cancelling direct copy removes only its temporary file", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, "large.iso");
  const destinationDir = path.join(root, "DVD");
  const destination = path.join(destinationDir, "Cancelled.iso");
  await fs.writeFile(source, Buffer.alloc(20 * 1024 * 1024, 0x7b));
  const controller = new AbortController();
  await assert.rejects(safeCopyFile(source, destination, { signal: controller.signal, onProgress: () => controller.abort() }), /cancel/i);
  await fs.access(source);
  await assert.rejects(fs.access(destination));
  await assert.rejects(fs.access(path.join(destinationDir, ".Cancelled.iso.part")));
});

test("normalize GAME_ID accepts dash, underscore and compact variants", () => {
  assert.equal(normalizeGameId("SLES-52541"), "SLES_525.41");
  assert.equal(normalizeGameId("sles_525.41"), "SLES_525.41");
  assert.equal(normalizeGameId("SCES 539 29"), "SCES_539.29");
});

test("filesystem preflight routes FAT32 large images to UL and exFAT to direct ISO", () => {
  assert.deepEqual(chooseImportStrategy("vfat", FAT32_MAX_FILE_BYTES + 1, "ISO"), { destinationFormat: "UL", strategy: "iso2opl" });
  assert.deepEqual(chooseImportStrategy("vfat", FAT32_MAX_FILE_BYTES + 1, "ZSO"), { destinationFormat: "UL", strategy: "zso-to-ul" });
  assert.deepEqual(chooseImportStrategy("exfat", 8 * 1024 ** 3, "ISO"), { destinationFormat: "ISO", strategy: "direct-copy" });
});

test("safe delete removes only the selected game and its prefixed artwork", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const dvd = path.join(root, "DVD");
  const art = path.join(root, "ART");
  await fs.mkdir(dvd, { recursive: true });
  await fs.mkdir(art, { recursive: true });
  const selected = path.join(dvd, "SCUS_974.81.Selected.iso");
  const other = path.join(dvd, "SCES_539.25.Other.iso");
  await fs.writeFile(selected, "selected");
  await fs.writeFile(other, "other");
  await fs.writeFile(path.join(art, "SCUS_974.81_COV.png"), "art");
  await fs.writeFile(path.join(art, "SCES_539.25_COV.png"), "other-art");
  const result = await deleteGameAndRelatedFiles(selected, art, "SCUS_974.81");
  assert.equal(result.success, true);
  await assert.rejects(fs.access(selected));
  await assert.rejects(fs.access(path.join(art, "SCUS_974.81_COV.png")));
  assert.equal(await fs.readFile(other, "utf8"), "other");
  assert.equal(await fs.readFile(path.join(art, "SCES_539.25_COV.png"), "utf8"), "other-art");
});

test("artwork discovery and mocked HTTP download retain every returned image type", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const gameId = "SCES_539.29";
  const names = [`${gameId}_COV.png`, `${gameId}_BG_00.png`, `${gameId}_COV2.png`, `${gameId}_LAB.png`, `${gameId}_LGO.png`, `${gameId}_SCR_01.png`];
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const fetchMock: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("/contents/")) {
      return new Response(JSON.stringify([
        ...names.map((name) => ({ type: "file", name, download_url: `https://mock.invalid/${name}`, size: png.length })),
        { type: "file", name: `${gameId}_notes.txt`, download_url: "https://mock.invalid/nope" },
        { type: "dir", name: `${gameId}_fake.png` },
      ]), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(png, { status: 200, headers: { "content-type": "image/png" } });
  };
  const service = new ArtDatabaseService({ cacheDir: path.join(root, "cache"), fetchFn: fetchMock, retries: 0 });
  const discovered = await service.discover(gameId);
  assert.deepEqual(discovered.data.map((item) => item.fileName), names);
  const result = await service.downloadAll(path.join(root, "ART"), gameId);
  assert.equal(result.data.length, names.length);
  assert.equal(result.data.every((item) => !!item.savedPath && !item.error), true);
  assert.deepEqual((await fs.readdir(path.join(root, "ART"))).sort(), names.sort());
});
