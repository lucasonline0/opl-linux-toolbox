import * as fs from "fs/promises";
import path from "path";
import os from "os";
import { convertIsoToUl } from "../services/ul-conversion.service";
import { scanUlInstallations } from "../services/ul.service";

async function main() {
  const source = process.argv[2];
  const gameId = process.argv[3];
  if (!source || !gameId) throw new Error("Usage: ul-live-smoke <source.iso> <GAME_ID>");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "opl-ul-live-"));
  try {
    for (const folder of ["CD", "DVD", "ART", "CFG", "VMC", "POPS", "VCD", "APPS"]) await fs.mkdir(path.join(root, folder));
    const result = await convertIsoToUl(source, root, path.basename(source, path.extname(source)), gameId, "DVD", { onProgress: (message) => console.log(message) });
    const scan = await scanUlInstallations(root);
    console.log(JSON.stringify({ root, result, scan }, null, 2));
    if (!result.success || !scan.some((item) => item.gameId === gameId && item.kind === "complete")) process.exitCode = 1;
  } finally {
    if (process.env.KEEP_UL_SMOKE !== "1") await fs.rm(root, { recursive: true, force: true });
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
