import { app } from "electron";
import { createHash } from "crypto";
import { createWriteStream, createReadStream } from "fs";
import { access, chmod, copyFile, mkdir, readFile, rename, rm } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { spawn } from "child_process";
import { createLogger } from "../logger";
import { checkForUpdates } from "./update.service";

const log = createLogger("linux-updater");
const REPO = "lucasonline0/opl-linux-toolbox";
const RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const ALLOWED_HOSTS = new Set(["github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com"]);

type PackageKind = "pacman" | "deb" | "rpm" | "appimage";
interface ReleaseAsset { name: string; browser_download_url: string; }

function packageKind(): PackageKind {
  if (process.env.APPIMAGE) return "appimage";
  if (existsSync("/usr/bin/pacman")) return "pacman";
  if (existsSync("/usr/bin/apt-get")) return "deb";
  if (existsSync("/usr/bin/dnf") || existsSync("/usr/bin/zypper")) return "rpm";
  return "appimage";
}

function suffix(kind: PackageKind): string {
  return kind === "pacman" ? ".pacman" : kind === "deb" ? ".deb" : kind === "rpm" ? ".rpm" : ".AppImage";
}

function safeAsset(asset: ReleaseAsset, ending: string): boolean {
  try {
    const url = new URL(asset.browser_download_url);
    return ALLOWED_HOSTS.has(url.hostname) && /^[A-Za-z0-9._-]+$/.test(asset.name) && asset.name.endsWith(ending);
  } catch { return false; }
}

async function sha256(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

async function download(url: string, target: string): Promise<void> {
  const response = await fetch(url, { headers: { Accept: "application/octet-stream", "User-Agent": "OPL-Linux-Toolbox" } });
  if (!response.ok || !response.body) throw new Error(`Download failed (HTTP ${response.status})`);
  const finalHost = new URL(response.url).hostname;
  if (!ALLOWED_HOSTS.has(finalHost)) throw new Error("Release download redirected outside GitHub");
  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(target, { flags: "wx" }));
}

function runPrivileged(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("pkexec", [command, ...args], { stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Update installation was cancelled or failed")));
  });
}

/** Downloads a verified release asset selected solely by the main process, then invokes the native package installer. */
export async function installLatestLinuxUpdate(): Promise<void> {
  if (process.platform !== "linux") throw new Error("In-app updates are currently available on Linux only");
  const status = await checkForUpdates();
  if (!status.updateAvailable) return;
  const kind = packageKind();
  const releaseResponse = await fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json", "User-Agent": "OPL-Linux-Toolbox" } });
  if (!releaseResponse.ok) throw new Error(`Could not load the latest release (HTTP ${releaseResponse.status})`);
  const release = await releaseResponse.json() as { assets: ReleaseAsset[] };
  const asset = release.assets.find((item) => safeAsset(item, suffix(kind)));
  const sums = release.assets.find((item) => item.name === "SHA256SUMS" && safeAsset(item, "SHA256SUMS"));
  if (!asset || !sums) throw new Error("The latest release does not contain a compatible verified Linux package");

  const workdir = path.join(app.getPath("temp"), `opl-linux-toolbox-update-${Date.now()}`);
  await mkdir(workdir, { recursive: true, mode: 0o700 });
  const part = path.join(workdir, `${asset.name}.part`);
  const packageFile = path.join(workdir, asset.name);
  try {
    await download(sums.browser_download_url, path.join(workdir, "SHA256SUMS"));
    const sumsText = await readFile(path.join(workdir, "SHA256SUMS"), "utf8");
    const expected = sumsText.split(/\r?\n/).map((line) => line.match(/^([a-f0-9]{64})\s+(.+)$/i)).find((match) => match?.[2] === asset.name)?.[1];
    if (!expected) throw new Error("The release checksum manifest does not contain the selected package");
    await download(asset.browser_download_url, part);
    if ((await sha256(part)).toLowerCase() !== expected.toLowerCase()) throw new Error("Release checksum verification failed");
    await rename(part, packageFile);
    log.info(`Installing verified update ${asset.name} via ${kind}`);
    if (kind === "appimage") {
      const current = process.env.APPIMAGE;
      if (!current) throw new Error("Could not locate the current AppImage");
      await access(current);
      await copyFile(packageFile, current);
      await chmod(current, 0o755);
    } else if (kind === "pacman") await runPrivileged("/usr/bin/pacman", ["-U", "--noconfirm", packageFile]);
    else if (kind === "deb") await runPrivileged("/usr/bin/apt-get", ["install", "-y", packageFile]);
    else if (existsSync("/usr/bin/dnf")) await runPrivileged("/usr/bin/dnf", ["install", "-y", packageFile]);
    else await runPrivileged("/usr/bin/zypper", ["--non-interactive", "install", packageFile]);
    app.relaunch();
    app.exit(0);
  } catch (error) {
    await rm(workdir, { recursive: true, force: true });
    throw error;
  }
}
