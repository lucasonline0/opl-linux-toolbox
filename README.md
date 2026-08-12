<p align="center">
  <img src="angular/public/logo.png" alt="OPL Linux Toolbox" width="150" />
</p>

<h1 align="center">OPL Linux Toolbox</h1>

<p align="center">
  <strong>Safe, Linux-first management for Open PS2 Loader libraries.</strong><br />
  Import games, manage artwork, CFG and VMC files, inspect storage, and repair your OPL library from one desktop app.
</p>

<p align="center">
  <a href="https://github.com/lucasonline0/opl-linux-toolbox/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/lucasonline0/opl-linux-toolbox?style=flat-square"></a>
  <a href="LICENSE"><img alt="GPL-3.0" src="https://img.shields.io/github/license/lucasonline0/opl-linux-toolbox?style=flat-square"></a>
  <a href="https://github.com/lucasonline0/opl-linux-toolbox/issues"><img alt="Issues" src="https://img.shields.io/github/issues/lucasonline0/opl-linux-toolbox?style=flat-square"></a>
  <img alt="Linux" src="https://img.shields.io/badge/platform-Linux-111827?style=flat-square&logo=linux&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Electron%20%2B%20Angular-111827?style=flat-square&logo=typescript&logoColor=white">
</p>

<p align="center">
  <a href="#install"><strong>Install</strong></a> ·
  <a href="#preview"><strong>Preview</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#how-this-project-differs"><strong>What is different</strong></a> ·
  <a href="#contributing"><strong>Contributing</strong></a> ·
  <a href="https://github.com/lucasonline0/opl-linux-toolbox/releases/latest"><strong>Latest release</strong></a>
</p>

---

## Why OPL Linux Toolbox?

OPL Linux Toolbox is built around a simple goal: make managing an Open PS2 Loader setup safer and easier on Linux.

- **Safe by default** — atomic `.part` copies, optional SHA-256 verification and targeted rollback.
- **OPL-aware** — understands PS2 DVD/CD, PS1/POPS, APPS/ELF, ART, CFG and VMC layouts.
- **Storage-aware** — discovers Linux mounts and reports filesystem, capacity and free space.
- **FAT32-friendly** — handles UL/USBExtreme installations when large files cannot be copied normally.
- **No destructive setup** — the app never formats devices and never requires `sudo`.
- **Native Linux packages** — AppImage, `.deb`, `.rpm` and Arch/Pacman packages are published with checksums.

It works with a local folder, USB drive, mounted NAS/share, or any other library directory already mounted by the operating system.

## How this project differs

OPL Linux Toolbox is a GPL-3.0 derivative of **OrbitOPL Toolbox** with its upstream credits and contributor history preserved. It is not presented as an unrelated rewrite.

The project deliberately takes a different direction by treating Linux as a first-class target and putting extra emphasis on storage safety and distribution:

| Area | OPL Linux Toolbox direction |
| --- | --- |
| File transfers | Temporary `.part` files, optional SHA-256 verification and targeted rollback |
| Linux storage | Mount discovery, filesystem/capacity inspection and safe unmount workflows |
| FAT32 | UL/USBExtreme handling for files that exceed FAT32 limits |
| Distribution | AppImage, DEB, RPM and Arch/Pacman packages plus checksum-verified installer |
| Security posture | Restricted Electron preload bridge, `contextIsolation`, no `shell: true` command execution |
| Scope | Local OPL library management; no commercial game-download catalog |

The long-term goal is to keep expanding OPL-aware diagnostics, device workflows and safe library maintenance without sacrificing the straightforward library-management experience inherited from upstream.

## Install

### One-command installer

```bash
curl -fsSL https://raw.githubusercontent.com/lucasonline0/opl-linux-toolbox/main/install.sh | bash
```

The installer downloads the latest stable GitHub Release, verifies its checksum and selects the best package for the current distribution:

| Distribution | Package |
| --- | --- |
| Debian / Ubuntu / Mint | `.deb` |
| Fedora / openSUSE | `.rpm` |
| Arch-based systems | `.pacman` |
| Other 64-bit Linux distributions | `AppImage` |

The packaged application includes Electron. **Node.js and npm are not required to use the app.**

> Prefer installing manually? Download the package for your distribution from the [latest release](https://github.com/lucasonline0/opl-linux-toolbox/releases/latest).

## Preview

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="OPL Linux Toolbox dashboard" width="900" />
</p>

<table>
  <tr>
    <td width="50%" align="center"><strong>Library</strong></td>
    <td width="50%" align="center"><strong>Import</strong></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/library.png" alt="OPL Linux Toolbox library" /></td>
    <td><img src="docs/screenshots/import.png" alt="OPL Linux Toolbox import" /></td>
  </tr>
  <tr>
    <td width="50%" align="center"><strong>Settings</strong></td>
    <td width="50%" align="center"><strong>Linux-first workflow</strong></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/settings.png" alt="OPL Linux Toolbox settings" /></td>
    <td valign="top">
      <br />
      <ul>
        <li>Detect mounted storage</li>
        <li>Inspect filesystem and capacity</li>
        <li>Import with safe temporary files</li>
        <li>Verify copies with SHA-256</li>
        <li>Handle FAT32 / UL workflows</li>
        <li>Manage artwork, CFG and VMC data</li>
      </ul>
    </td>
  </tr>
</table>

## Features

### Game library

- Browse **PS2 DVD/CD**, **PS1/POPS** and **APPS/ELF** libraries.
- Detect game IDs and normalize library names.
- Rename or remove individual entries safely.
- Work with ISO, ZSO, CUE/BIN and ELF files.

### Safe imports

- Queue imports with visible progress.
- Copy through temporary `.part` files before committing the final file.
- Optionally verify transfers with SHA-256.
- Roll back the affected operation when an import fails.
- Convert ISO to ZSO and handle FAT32 UL/USBExtreme installations.

### OPL assets and configuration

- Download and repair artwork from the PSX / PS2 OPL art database.
- Manage per-game CFG settings.
- Manage VMC cards.
- Inspect maintenance findings and technical logs.

### Linux storage integration

- Discover mounted storage devices.
- Inspect filesystem, capacity and available space.
- Unmount supported devices safely from the application.
- Use distro-native packages without requiring a development environment.

## Supported OPL layout

```text
OPL_ROOT/
├── CD/ DVD/        PS2 images (.iso/.zso)
├── VCD/ POPS/      PS1 games and POPStarter launchers
├── APPS/           ELF applications
├── ART/            artwork
├── CFG/            per-game settings
└── VMC/            virtual memory cards
```

## What this project does not do

The online catalog, Store and external game-download integrations are intentionally not part of the application. OPL Linux Toolbox operates on libraries and files supplied by the user; it does not search for or distribute commercial game downloads.

## Contributing

Contributions, testing reports and reproducible bug reports are welcome.

- Browse the [open issues](https://github.com/lucasonline0/opl-linux-toolbox/issues).
- New contributors can start with issues labeled [`good first issue`](https://github.com/lucasonline0/opl-linux-toolbox/labels/good%20first%20issue).
- Bug and feature-request forms collect Linux distribution, package and OPL setup details so reports are easier to reproduce.
- Please keep PRs focused and avoid including copyrighted game images or private data in test fixtures/logs.

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

The Electron main process owns filesystem, storage, import and external-command access. The renderer uses a restricted preload API with `contextIsolation: true` and `nodeIntegration: false`. External commands are launched with argument arrays rather than `shell: true`.

## Architecture

- `src/main.ts` — Electron lifecycle and window security.
- `src/preload.ts` — restricted renderer bridge.
- `src/ipc/` — typed IPC handlers for library, import, artwork, storage, maintenance, VMC, CFG and logs.
- `src/services/` — safe-copy/import, UL conversion, artwork, storage and library services.
- `angular/src/app/` — dashboard, library, import, artwork, VMC, maintenance, settings, logs and game details pages.

## Project origins

OPL Linux Toolbox is based on and evolved from **OrbitOPL Toolbox** by **Luden02**:

https://github.com/Luden02/OrbitOPL-Toolbox

The upstream project is licensed under GPL-3.0. Its license, relevant copyright notices and contributor history remain part of this repository; the current maintainer does not claim authorship of the original project.

## Third-party projects

- **PSX / PS2 OPL Art Database**, maintained by Luden02, supplies artwork discovery for games in the user's library. It is a dump of the OPL Manager GameArt Database; this project does not claim ownership or invent a license for those images.
- **Open PS2 Loader**, maintained by the ps2homebrew contributors, defines the OPL folder, CFG, VMC and artwork conventions implemented here. OPL itself is not bundled.

See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for repositories, license notes and usage details.

## License

OPL Linux Toolbox is distributed under **GPL-3.0**. Original OrbitOPL credits, license notices and contributor history are preserved.
