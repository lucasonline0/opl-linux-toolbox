![OPL Linux Toolbox](angular/public/logo.png)

# OPL Linux Toolbox

OPL Linux Toolbox is a Linux-first Electron + Angular desktop application for
managing Open PS2 Loader libraries safely. It works on a local folder, USB
drive, NAS mount, or any other directory already mounted by the operating
system. It never formats a device and never requires `sudo`.

## Install

The recommended installation on a supported 64-bit Linux system is:

```bash
curl -fsSL https://raw.githubusercontent.com/lucasonline0/opl-linux-toolbox/main/install.sh | bash
```

The installer downloads the latest stable, checksum-verified GitHub Release
and selects a native `.deb` (Debian/Ubuntu/Mint), `.rpm` (Fedora/openSUSE),
`.pacman` (Arch-based systems), or AppImage (other distributions). The
installed application includes Electron and does not require Node.js, npm, or
a repository checkout. To remove it later, use the distribution package
manager or download `uninstall.sh`; user settings and library data are not
deleted.

## Screenshots

### Overview

![OPL Linux Toolbox overview](docs/screenshots/dashboard.png)

### Library

![OPL Linux Toolbox library](docs/screenshots/library.png)

### Import

![OPL Linux Toolbox import](docs/screenshots/import.png)

### Settings

![OPL Linux Toolbox settings](docs/screenshots/settings.png)

## Features

- Browse PS2 DVD/CD, PS1/POPS and APPS/ELF libraries.
- Import ISO, ZSO, CUE/BIN and ELF files with queued progress.
- Detect game IDs, normalize names, rename and remove individual games safely.
- Use atomic `.part` copies, optional SHA-256 verification and targeted rollback.
- Convert ISO to ZSO and handle FAT32 UL/USBExtreme installations.
- Download and repair artwork from the PSX/PS2 OPL art database.
- Manage CFG settings, VMC cards, maintenance findings and technical logs.
- Discover Linux mounts, inspect capacity/filesystem and unmount devices safely.

The online catalog, Store and external download-source integrations are not
part of the application. The app operates on libraries and files supplied by
the user; it does not search for or distribute commercial game downloads.

## Development

```bash
npm install
npm start                 # build and launch Electron
npm run build             # TypeScript main/preload build
cd angular && npm run build
npm run test:core         # safety, path containment and artwork tests
npm run test:live-art     # optional live artwork smoke test
npm run test:live-ul      # optional UL conversion smoke test
```

The main process owns filesystem, storage, import and external-command access.
The renderer uses a restricted preload API (`contextIsolation: true`,
`nodeIntegration: false`). External commands are launched with argument arrays,
never `shell: true`.

## Architecture

- `src/main.ts` — Electron lifecycle and window security.
- `src/preload.ts` — small, validated renderer bridge.
- `src/ipc/` — typed IPC handlers for library, import, artwork, storage,
  maintenance, VMC, CFG and logs.
- `src/services/` — safe-copy/import, UL conversion, artwork, storage and
  library services.
- `angular/src/app/` — dashboard, library, import, artwork, VMC, maintenance,
  settings, logs and game details pages.

## OPL layout

```text
OPL_ROOT/
├── CD/ DVD/       PS2 images (.iso/.zso)
├── VCD/ POPS/     PS1 games and POPStarter launchers
├── APPS/           ELF applications
├── ART/            artwork
├── CFG/            per-game settings
└── VMC/            virtual memory cards
```

## Project origins

OPL Linux Toolbox is based on and evolved from **OrbitOPL Toolbox** by
**Luden02**:

https://github.com/Luden02/OrbitOPL-Toolbox

The upstream project is licensed under GPL-3.0. Its license, relevant copyright
notices and contributor history remain part of this repository; the current
maintainer does not claim authorship of the original project.

## Third-party projects

- **PSX / PS2 OPL Art Database**, maintained by Luden02, supplies artwork
  discovery for games in the user's library. It is a dump of the OPL Manager
  GameArt Database; this project does not claim ownership or invent a license
  for those images.
- **Open PS2 Loader**, maintained by the ps2homebrew contributors, defines the
  OPL folder, CFG, VMC and artwork conventions implemented here. OPL itself is
  not bundled.

See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for repositories,
license notes and usage details. No online catalog or download provider is
included in the current build.

OPL Linux Toolbox is distributed under GPL-3.0. Original OrbitOPL credits and
license are preserved in `LICENSE`.
