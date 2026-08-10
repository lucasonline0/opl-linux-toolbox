import * as fs from "fs/promises";
import path from "path";
import os from "os";
import { ArtDatabaseService } from "../services/artwork.service";

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "opl-art-live-"));
  const service = new ArtDatabaseService({ cacheDir: path.join(root, "cache") });
  const report: any[] = [];
  try {
    for (const gameId of ["SCES_539.25", "SCES_539.29"]) {
      const artDir = path.join(root, gameId, "ART");
      const discovery = await service.discover(gameId, "PS2", undefined, true);
      if (!discovery.success) throw new Error(`${gameId} discovery failed: ${discovery.message}`);
      const download = await service.downloadAll(artDir, gameId, "PS2");
      const saved = (await fs.readdir(artDir)).filter((name) => !name.endsWith(".part"));
      report.push({
        gameId,
        apiReturned: discovery.data.map((item) => item.fileName),
        saved,
        count: saved.length,
        allValidated: download.data.length === discovery.data.length && download.data.every((item) => !!item.savedPath && !item.error),
        failures: download.data.filter((item) => item.error).map((item) => ({ file: item.fileName, error: item.error })),
      });
    }
    console.log(JSON.stringify({ temporaryRoot: root, report }, null, 2));
    if (report.some((item) => !item.allValidated)) process.exitCode = 1;
  } finally {
    if (process.env.KEEP_ARTWORK_SMOKE !== "1") await fs.rm(root, { recursive: true, force: true });
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
