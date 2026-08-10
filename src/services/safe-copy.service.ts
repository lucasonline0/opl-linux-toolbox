import * as fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { assertPathContained } from "../utils/path-safety";

export interface CopyProgress {
  stage: "copying" | "verifying-source" | "verifying-destination";
  percent: number;
  bytes: number;
  totalBytes: number;
  bytesPerSecond: number;
  etaSeconds: number | null;
}
async function hashFile(file: string, stage: CopyProgress["stage"], signal?: AbortSignal, onProgress?: (value: CopyProgress) => void): Promise<string> {
  const handle = await fs.open(file, "r");
  const totalBytes = (await handle.stat()).size;
  const digest = createHash("sha256");
  const buffer = Buffer.allocUnsafe(8 * 1024 * 1024);
  let bytes = 0;
  const started = Date.now();
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("Copy cancelled", "AbortError");
      const read = await handle.read(buffer, 0, buffer.length, null);
      if (!read.bytesRead) break;
      digest.update(buffer.subarray(0, read.bytesRead));
      bytes += read.bytesRead;
      const elapsed = Math.max((Date.now() - started) / 1000, 0.001);
      const speed = bytes / elapsed;
      onProgress?.({ stage, percent: totalBytes ? bytes / totalBytes * 100 : 100, bytes, totalBytes, bytesPerSecond: speed, etaSeconds: speed ? (totalBytes - bytes) / speed : null });
    }
    return digest.digest("hex");
  } finally { await handle.close(); }
}

export async function safeCopyFile(
  source: string,
  destination: string,
  options: { verifySha256?: boolean; signal?: AbortSignal; onProgress?: (value: CopyProgress) => void } = {},
): Promise<{ success: true; path: string; sha256?: string; bytes: number }> {
  const destinationDir = path.dirname(destination);
  assertPathContained(destinationDir, destination);
  const temporary = path.join(destinationDir, `.${path.basename(destination)}.part`);
  assertPathContained(destinationDir, temporary);
  await fs.mkdir(destinationDir, { recursive: true });
  await fs.access(destination).then(() => { throw new Error(`Destination already exists: ${destination}`); }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
  await fs.unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
  const input = await fs.open(source, "r");
  const output = await fs.open(temporary, "wx");
  const totalBytes = (await input.stat()).size;
  const buffer = Buffer.allocUnsafe(8 * 1024 * 1024);
  let bytes = 0;
  const started = Date.now();
  try {
    while (true) {
      if (options.signal?.aborted) throw new DOMException("Copy cancelled", "AbortError");
      const read = await input.read(buffer, 0, buffer.length, null);
      if (!read.bytesRead) break;
      await output.write(buffer, 0, read.bytesRead);
      bytes += read.bytesRead;
      const elapsed = Math.max((Date.now() - started) / 1000, 0.001);
      const speed = bytes / elapsed;
      options.onProgress?.({ stage: "copying", percent: totalBytes ? bytes / totalBytes * 100 : 100, bytes, totalBytes, bytesPerSecond: speed, etaSeconds: speed ? (totalBytes - bytes) / speed : null });
    }
    await output.sync();
    await output.close();
    await input.close();
    let sha256: string | undefined;
    if (options.verifySha256 !== false) {
      sha256 = await hashFile(source, "verifying-source", options.signal, options.onProgress);
      const targetHash = await hashFile(temporary, "verifying-destination", options.signal, options.onProgress);
      if (sha256 !== targetHash) throw new Error("SHA-256 verification failed");
    }
    await fs.rename(temporary, destination);
    const dirHandle = await fs.open(destinationDir, "r");
    await dirHandle.sync().catch(() => undefined);
    await dirHandle.close();
    return { success: true, path: destination, sha256, bytes };
  } catch (error) {
    await input.close().catch(() => undefined);
    await output.close().catch(() => undefined);
    await fs.unlink(temporary).catch(() => undefined);
    throw error;
  }
}
