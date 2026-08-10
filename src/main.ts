import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  net,
  protocol,
} from "electron";
import path from "path";
import { pathToFileURL } from "url";
import electronReloader from "electron-reloader";
import PackageInfo from "../package.json";
import { createLogger, setLogWindow } from "./logger";
import { registerAllIpc } from "./ipc";
import { APP_CONFIG } from "./app-config";
import { artworkPath } from "./services/art-url.service";

protocol.registerSchemesAsPrivileged([{ scheme: "opl-art", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

const log = createLogger("main");

const size = { width: 1200, height: 760, minWidth: 1000, minHeight: 680 };

// Tracks whether the renderer has a long-running action in progress.
// Updated via the "set-loading-state" IPC channel from LibraryService.
let rendererIsLoading = false;
let forceCloseRequested = false;
let gpuStatusLogged = false;

function createWindow() {
  const isMac = process.platform === "darwin";

  const win = new BrowserWindow({
    width: size.width,
    height: size.height,
    minWidth: size.minWidth,
    minHeight: size.minHeight,
    title: `${APP_CONFIG.name} (${PackageInfo.version})`,
    icon: path.join(__dirname, "assets", "applogo", "icon_512x512.png"),
    frame: isMac,
    backgroundColor: "#090b11",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  win.on("maximize", () => win.webContents.send("window-maximized-change", true));
  win.on("unmaximize", () => win.webContents.send("window-maximized-change", false));

  setLogWindow(win);
  win.on("closed", () => setLogWindow(null));

  win.on("close", (event) => {
    if (!rendererIsLoading || forceCloseRequested) {
      return;
    }
    log.warn("Close requested while an action is still running");
    event.preventDefault();
    const choice = dialog.showMessageBoxSync(win, {
      type: "warning",
      buttons: ["Cancel", "Close anyway"],
      defaultId: 0,
      cancelId: 0,
      title: "Action in progress",
      message:
        "An action is still running. Closing now may leave files in an inconsistent state.",
      detail: "Do you want to close the application anyway?",
    });
    if (choice === 1) {
      forceCloseRequested = true;
      win.destroy();
    }
  });

  win.removeMenu();
  if (process.platform === "darwin") {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: APP_CONFIG.name,
          submenu: [
            {
              label: "Quit",
              accelerator: "CmdOrCtrl+Q",
              click: () => {
                app.quit();
              },
            },
          ],
        },
      ])
    );
  } else {
    Menu.setApplicationMenu(null);
  }

  const args = process.argv.slice(1);
  const serve = args.includes("--serve");

  // Safety net: catches stray console.* output from third-party code that
  // bypasses the structured logger (logger.ts). Not a duplicate — the logger
  // sends entries with a `location` field; this wrapper does not. The logger
  // also captures the original console references at module load, before this
  // patch runs, so logger entries are never double-forwarded.
  const origLog = console.log;
  const origError = console.error;
  const origWarn = console.warn;

  const sendLog = (level: string, args: any[]) => {
    try {
      if (win && !win.isDestroyed()) {
        win.webContents.send("main-log", {
          level,
          message: args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "),
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // Ignore errors during log forwarding
    }
  };

  console.log = (...args: any[]) => {
    origLog.apply(console, args);
    sendLog("INF", args);
  };
  console.error = (...args: any[]) => {
    origError.apply(console, args);
    sendLog("ERR", args);
  };
  console.warn = (...args: any[]) => {
    origWarn.apply(console, args);
    sendLog("INF", args);
  };

  log.info(
    `Launching ${APP_CONFIG.name} v${PackageInfo.version} (${
      serve ? "dev/serve" : "packaged"
    } mode) on ${process.platform}`
  );

  if (serve) {
    electronReloader(module);
    win.loadURL("http://localhost:4200");
    win.webContents.openDevTools();
  } else {
    win.loadFile(
      path.join(__dirname, "..", "angular", "browser", "index.html")
    );
  }
  win.webContents.once("did-finish-load", () => {
    if (!gpuStatusLogged) { gpuStatusLogged = true; log.info(`GPU features: ${JSON.stringify(app.getGPUFeatureStatus())}`); }
  });
}

// Register all IPC handlers (pure side-effect, no window needed)
registerAllIpc();

// This handler needs access to local state, so it stays here
ipcMain.on("set-loading-state", (_event, isLoading: boolean) => {
  rendererIsLoading = !!isLoading;
  log.verbose(`Renderer loading state -> ${rendererIsLoading ? "busy" : "idle"}`);
});

app.whenReady().then(async () => {
  protocol.handle("opl-art", (request) => {
    const url = new URL(request.url);
    const filePath = url.hostname === "asset" ? artworkPath(url.pathname.slice(1)) : undefined;
    return filePath ? net.fetch(pathToFileURL(filePath).toString()) : new Response("Not found", { status: 404 });
  });
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("browser-window-focus", function () {
  globalShortcut.register("CommandOrControl+R", () => {
    log.verbose("Blocked reload shortcut (Cmd/Ctrl+R)");
  });
  globalShortcut.register("F5", () => {
    log.verbose("Blocked reload shortcut (F5)");
  });
});

app.on("browser-window-blur", function () {
  globalShortcut.unregister("CommandOrControl+R");
  globalShortcut.unregister("F5");
});
