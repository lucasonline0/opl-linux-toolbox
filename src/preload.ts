import { contextBridge, ipcRenderer } from "electron";

function buildLibraryAPI() {
  return {
    // ── Directory & structure ───────────────────────
    openAskDirectory: () => ipcRenderer.invoke("open-ask-directory"),
    checkOplStructure: (dirPath: string) =>
      ipcRenderer.invoke("check-opl-structure", dirPath),
    createOplFolders: (dirPath: string, folders: string[]) =>
      ipcRenderer.invoke("create-opl-folders", dirPath, folders),
    directoryExists: (dirPath: string) =>
      ipcRenderer.invoke("directory-exists", dirPath),

    // ── Game scanning ──────────────────────────────
    getGamesFiles: (dirPath: string) =>
      ipcRenderer.invoke("get-games-files", dirPath),
    getULGames: (dirPath: string) =>
      ipcRenderer.invoke("get-ul-games", dirPath),
    getArtFolder: (dirPath: string) =>
      ipcRenderer.invoke("get-art-folder", dirPath),

    // ── Game ID resolution ─────────────────────────
    resolveIsoGameId: (filepath: string) =>
      ipcRenderer.invoke("resolve-iso-gameid", filepath),
    tryDetermineGameIdFromHex: (filepath: string) =>
      ipcRenderer.invoke("try-determine-gameid-from-hex", filepath),
    tryDeterminePs1GameIdFromHex: (filepath: string) =>
      ipcRenderer.invoke("try-determine-ps1-gameid-from-hex", filepath),
    tryDeterminePs1GameIdFromVcd: (filepath: string) =>
      ipcRenderer.invoke("try-determine-ps1-gameid-from-vcd", filepath),

    // ── Artwork ────────────────────────────────────
    downloadArtByGameId: (
      dirPath: string,
      gameId: string,
      system?: "PS1" | "PS2",
      saveAsName?: string,
      artTypes?: string[]
    ) =>
      ipcRenderer.invoke(
        "download-art-by-gameid",
        dirPath,
        gameId,
        system,
        saveAsName,
        artTypes
      ),
    checkArtFilesExist: (artDir: string, filenames: string[]) =>
      ipcRenderer.invoke("check-art-files-exist", artDir, filenames),
    listAvailableArt: (gameId: string, system?: "PS1" | "PS2") =>
      ipcRenderer.invoke("list-available-art", gameId, system),
    clearArtworkCache: () => ipcRenderer.invoke("clear-artwork-cache"),
    openArtFolder: (root: string) => ipcRenderer.invoke("open-art-folder", root),
    importArtworkManual: (root: string, gameId: string) => ipcRenderer.invoke("import-artwork-manual", root, gameId),

    // ── Linux storage ─────────────────────────────
    discoverStorage: () => ipcRenderer.invoke("storage-discover"),
    inspectStorage: (root: string) => ipcRenderer.invoke("storage-inspect", root),
    unmountStorage: (root: string) => ipcRenderer.invoke("storage-unmount", root),

    // ── Safe PS2 import ───────────────────────────
    preflightSafeImport: (request: unknown) => ipcRenderer.invoke("preflight-safe-import", request),
    runSafeImport: (jobId: string, request: unknown) => ipcRenderer.invoke("run-safe-import", jobId, request),
    cancelSafeImport: (jobId: string) => ipcRenderer.invoke("cancel-safe-import", jobId),
    onSafeImportProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on("safe-import-progress", (_event, progress) => callback(progress));
    },
    removeAllSafeImportProgressListeners: () => ipcRenderer.removeAllListeners("safe-import-progress"),

    // ── Maintenance ───────────────────────────────
    scanMaintenance: (root: string) => ipcRenderer.invoke("maintenance-scan", root),
    repairMaintenanceIssue: (root: string, issueId: string) => ipcRenderer.invoke("maintenance-repair", root, issueId),

    // ── Rename ─────────────────────────────────────
    renameGamefile: (
      dirPath: string,
      gameId: string,
      gameName: string,
      nameOnly?: boolean
    ) =>
      ipcRenderer.invoke(
        "rename-gamefile",
        dirPath,
        gameId,
        gameName,
        !!nameOnly
      ),
    renamePs1LauncherStep1: (
      vcdPath: string,
      gameId: string,
      newTitle: string
    ) =>
      ipcRenderer.invoke("rename-ps1-launcher-step1", vcdPath, gameId, newTitle),
    renamePs1LauncherStep2: (params: {
      newAppsFolder: string;
      oldElfFile?: string;
      newElfFile?: string;
      newCfgContent?: string;
      newTitle: string;
    }) => ipcRenderer.invoke("rename-ps1-launcher-step2", params),
    onRenamePs1Progress: (
      callback: (progress: { percent: number; stage: string }) => void
    ) => {
      ipcRenderer.on("rename-ps1-progress", (_event, progress) =>
        callback(progress)
      );
    },
    removeAllRenamePs1ProgressListeners: () => {
      ipcRenderer.removeAllListeners("rename-ps1-progress");
    },

    // ── Delete ─────────────────────────────────────
    deleteApp: (oplRoot: string, folder: string) =>
      ipcRenderer.invoke("delete-app", oplRoot, folder),
    deleteAppWithProgress: (
      oplRoot: string,
      folder: string,
      bootName: string
    ) =>
      ipcRenderer.invoke(
        "delete-app-with-progress",
        oplRoot,
        folder,
        bootName
      ),
    onDeleteAppProgress: (
      callback: (entry: {
        label: string;
        path?: string;
        success: boolean;
        error?: string;
      }) => void
    ) => {
      ipcRenderer.on("delete-app-progress", (_event, entry) =>
        callback(entry)
      );
    },
    removeAllDeleteAppProgressListeners: () => {
      ipcRenderer.removeAllListeners("delete-app-progress");
    },
    deleteGameAndRelatedFiles: (
      gamePath: string,
      artDir: string,
      gameId: string,
      launcherFolder?: string,
      bootName?: string
    ) =>
      ipcRenderer.invoke(
        "delete-game-and-related-files",
        gamePath,
        artDir,
        gameId,
        launcherFolder,
        bootName
      ),
    deleteUlGame: (root: string, gameId: string, removeArtwork: boolean) =>
      ipcRenderer.invoke("delete-ul-game", root, gameId, removeArtwork),
    onDeletePs1Progress: (
      callback: (entry: {
        label: string;
        path?: string;
        success: boolean;
        error?: string;
      }) => void
    ) => {
      ipcRenderer.on("delete-ps1-progress", (_event, entry) =>
        callback(entry)
      );
    },
    removeAllDeletePs1ProgressListeners: () => {
      ipcRenderer.removeAllListeners("delete-ps1-progress");
    },

    // ── Import ─────────────────────────────────────
    importPs1Game: (
      cueFilePath: string,
      oplRoot: string,
      elfPrefix: string,
      downloadArtwork: boolean
    ) =>
      ipcRenderer.invoke(
        "import-ps1-game",
        cueFilePath,
        oplRoot,
        elfPrefix,
        downloadArtwork
      ),
    onPs1ImportProgress: (
      callback: (progress: { percent: number; stage: string }) => void
    ) => {
      ipcRenderer.on("ps1-import-progress", (_event, progress) =>
        callback(progress)
      );
    },
    removeAllPs1ImportProgressListeners: () => {
      ipcRenderer.removeAllListeners("ps1-import-progress");
    },
    importPs2CdGame: (
      cueFilePath: string,
      oplRoot: string,
      gameId: string | undefined,
      gameName: string | undefined,
      downloadArtwork: boolean
    ) =>
      ipcRenderer.invoke(
        "import-ps2-cd-game",
        cueFilePath,
        oplRoot,
        gameId,
        gameName,
        downloadArtwork
      ),
    onPs2CdImportProgress: (
      callback: (progress: { percent: number; stage: string }) => void
    ) => {
      ipcRenderer.on("ps2-cd-import-progress", (_event, progress) =>
        callback(progress)
      );
    },
    removeAllPs2CdImportProgressListeners: () => {
      ipcRenderer.removeAllListeners("ps2-cd-import-progress");
    },
    openAskGameFiles: (isGameCd: boolean, isGameDvd: boolean) =>
      ipcRenderer.invoke("open-ask-game-files", isGameCd, isGameDvd),
    openAskElfFiles: () => ipcRenderer.invoke("open-ask-elf-files"),
    importApp: (oplRoot: string, elfPath: string, title: string) =>
      ipcRenderer.invoke("import-app", oplRoot, elfPath, title),

    // ── CFG ────────────────────────────────────────
    readGameCfg: (oplRoot: string, gameId: string) =>
      ipcRenderer.invoke("read-game-cfg", oplRoot, gameId),
    writeGameCfg: (
      oplRoot: string,
      gameId: string,
      entries: Record<string, string>
    ) => ipcRenderer.invoke("write-game-cfg", oplRoot, gameId, entries),
    readAppTitleCfg: (oplRoot: string, folder: string) =>
      ipcRenderer.invoke("read-app-title-cfg", oplRoot, folder),
    updatePs1TitleCfg: (
      launcherPath: string,
      newTitle: string,
      gameId?: string
    ) =>
      ipcRenderer.invoke(
        "update-ps1-title-cfg",
        launcherPath,
        newTitle,
        gameId
      ),

    // ── APPS ───────────────────────────────────────
    getApps: (oplRoot: string) => ipcRenderer.invoke("get-apps", oplRoot),
    getPs1Launchers: (oplRoot: string) =>
      ipcRenderer.invoke("get-ps1-launchers", oplRoot),

    // ── VMC ────────────────────────────────────────
    listVmc: (oplRoot: string) => ipcRenderer.invoke("list-vmc", oplRoot),
    checkPopsVmc: (oplRoot: string, gameTitle: string) =>
      ipcRenderer.invoke("check-pops-vmc", oplRoot, gameTitle),
    createVmc: (oplRoot: string, name: string, sizeMb: number) =>
      ipcRenderer.invoke("create-vmc", oplRoot, name, sizeMb),
    deleteVmc: (oplRoot: string, name: string) =>
      ipcRenderer.invoke("delete-vmc", oplRoot, name),

    // ── Compression ────────────────────────────────
    compressIsoToZso: (
      isoPath: string,
      zsoPath: string,
      deleteOriginal: boolean
    ) =>
      ipcRenderer.invoke(
        "compress-iso-to-zso",
        isoPath,
        zsoPath,
        deleteOriginal
      ),
    onZsoCompressProgress: (
      callback: (progress: { percent: number; stage: string }) => void
    ) => {
      ipcRenderer.on("zso-compress-progress", (_event, progress) =>
        callback(progress)
      );
    },
    removeAllZsoCompressProgressListeners: () => {
      ipcRenderer.removeAllListeners("zso-compress-progress");
    },
    // ── Settings & updates ─────────────────────────
    getSettings: () => ipcRenderer.invoke("get-settings"),
    setSetting: (key: string, value: unknown) =>
      ipcRenderer.invoke("set-setting", key, value),
    checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
    openExternal: (url: string) => ipcRenderer.invoke("open-external", url),

    // ── Logs ───────────────────────────────────────
    onMainLog: (
      callback: (entry: {
        level: string;
        location?: string;
        message: string;
        timestamp: string;
      }) => void
    ) => {
      ipcRenderer.on("main-log", (_event, entry) => callback(entry));
    },
    removeAllMainLogListeners: () => {
      ipcRenderer.removeAllListeners("main-log");
    },

    // ── Loading state ──────────────────────────────
    setLoadingState: (isLoading: boolean) =>
      ipcRenderer.send("set-loading-state", isLoading),
  };
}

function buildWindowAPI() {
  return {
    platform: () => ipcRenderer.invoke("window-platform"),
    canWindowControls: () => ipcRenderer.invoke("window-can-window-controls"),
    wmInfo: () => ipcRenderer.invoke("window-wm-info"),
    minimize: () => ipcRenderer.send("window-minimize"),
    maximizeToggle: () => ipcRenderer.send("window-maximize-toggle"),
    close: () => ipcRenderer.send("window-close"),
    isMaximized: () => ipcRenderer.invoke("window-is-maximized"),
    onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
      ipcRenderer.on("window-maximized-change", (_event, isMaximized) =>
        callback(isMaximized)
      );
    },
    removeAllMaximizedChangeListeners: () => {
      ipcRenderer.removeAllListeners("window-maximized-change");
    },
  };
}

contextBridge.exposeInMainWorld("libraryAPI", buildLibraryAPI());
contextBridge.exposeInMainWorld("windowAPI", buildWindowAPI());
