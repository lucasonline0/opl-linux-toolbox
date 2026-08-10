import crypto from "crypto";

const artworkFiles = new Map<string, string>();

export function artworkUrl(filePath: string): string {
  const token = crypto.createHash("sha256").update(filePath).digest("hex");
  artworkFiles.set(token, filePath);
  return `opl-art://asset/${token}`;
}

export function artworkPath(token: string): string | undefined {
  return /^[a-f0-9]{64}$/.test(token) ? artworkFiles.get(token) : undefined;
}
