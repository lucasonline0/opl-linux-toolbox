import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs/promises";
import path from "path";
import os from "os";
import { buildUlTransferProgress, measureNewUlBytes } from "../services/ul-conversion.service";

async function fixture(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "opl-ul-progress-test-"));
}

test("UL progress measures only chunks created after the import snapshot", async (t) => {
  const root = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const existingChunk = "ul.11111111.SCUS_974.81.00";
  await fs.writeFile(path.join(root, existingChunk), Buffer.alloc(128));
  await fs.writeFile(path.join(root, "ul.cfg"), Buffer.alloc(64));

  const snapshot = new Set([existingChunk, "ul.cfg"]);
  await fs.writeFile(path.join(root, "ul.22222222.SCUS_974.81.00"), Buffer.alloc(1024));
  await fs.writeFile(path.join(root, "ul.22222222.SCUS_974.81.01"), Buffer.alloc(2048));
  await fs.writeFile(path.join(root, "notes.txt"), Buffer.alloc(4096));

  assert.equal(await measureNewUlBytes(root, snapshot), 3072);
});

test("UL progress reports bounded percent, throughput and ETA", () => {
  const half = buildUlTransferProgress(512, 1024, 2);
  assert.equal(half.percent, 50);
  assert.equal(half.bytes, 512);
  assert.equal(half.totalBytes, 1024);
  assert.equal(half.bytesPerSecond, 256);
  assert.equal(half.etaSeconds, 2);
  assert.match(half.stage, /Installing UL/);
  assert.match(half.stage, /MiB\/s/);
  assert.match(half.stage, /ETA/);

  const done = buildUlTransferProgress(2048, 1024, 2);
  assert.equal(done.percent, 100);
  assert.equal(done.bytes, 1024);
  assert.equal(done.etaSeconds, 0);
});
