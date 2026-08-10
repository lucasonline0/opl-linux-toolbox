import { app } from "electron";
import fs from "fs";
import path from "path";
import { createLogger } from "../logger";

const log = createLogger("settings");

/**
 * Persisted application settings. Stored as JSON in the Electron userData
 * directory so they survive across launches.
 */
export interface AppSettings {
  /** Last mounted OPL library root directory. */
  lastDirectory?: string;
  /** Re-mount the last directory automatically on launch. */
  autoReconnect: boolean;
  autoArtwork: boolean;
  downloadAllArtwork: boolean;
  verifySha256: boolean;
  confirmDestructiveActions: boolean;
  theme: "auto" | "dark" | "light";
  animations: boolean;
  density: "comfortable" | "compact";
  accent: "blue" | "coral" | "purple" | "green" | "amber";
  glassIntensity: "low" | "medium" | "high";
  cornerRadius: "subtle" | "default" | "soft";
  /** Runtime-only capability; never contains the token itself. */
  githubTokenAvailable?: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  lastDirectory: undefined,
  autoReconnect: true,
  autoArtwork: true,
  downloadAllArtwork: true,
  verifySha256: true,
  confirmDestructiveActions: true,
  theme: "auto",
  animations: true,
  density: "comfortable",
  accent: "blue",
  glassIntensity: "medium",
  cornerRadius: "default",
};

function settingsFilePath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

export function getSettings(): AppSettings {
  try {
    const raw = fs.readFileSync(settingsFilePath(), "utf-8");
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    // Drop legacy online-source settings from older installations.
    delete (parsed as Record<string, unknown>).allowHttpLanSources;
    // Merge over defaults so newly-added settings have sane values.
    const legacyAppearance = !("theme" in parsed) && !("glassIntensity" in parsed);
    if (legacyAppearance && parsed.accent === "coral") parsed.accent = "blue";
    if (parsed.accent === ("violet" as AppSettings["accent"])) parsed.accent = "purple";
    return { ...DEFAULT_SETTINGS, ...parsed, githubTokenAvailable: !!process.env.GITHUB_TOKEN };
  } catch {
    // Missing or unreadable file — fall back to defaults.
    return { ...DEFAULT_SETTINGS, githubTokenAvailable: !!process.env.GITHUB_TOKEN };
  }
}

export function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): AppSettings {
  const settings = getSettings();
  if (key === "githubTokenAvailable") throw new Error("Runtime capability is read-only");
  settings[key] = value;
  try {
    const { githubTokenAvailable: _runtimeOnly, ...persisted } = settings;
    fs.writeFileSync(settingsFilePath(), JSON.stringify(persisted, null, 2));
    log.verbose(`Persisted setting "${String(key)}" = ${JSON.stringify(value)}`);
  } catch (error) {
    log.error(`Failed to persist setting "${String(key)}":`, error);
  }
  return settings;
}

export function directoryExists(dirPath: string): boolean {
  try {
    return !!dirPath && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}
