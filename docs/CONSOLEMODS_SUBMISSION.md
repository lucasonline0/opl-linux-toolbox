# ConsoleMods Wiki submission draft

This document is a neutral, factual draft for a possible `PS2:OPL Linux Toolbox` page on ConsoleMods Wiki. It intentionally avoids marketing language.

ConsoleMods uses console namespaces such as `PS2:` and allows contributors to create pages by navigating to the desired page name and selecting **Create**. Its Wiki Crash Course recommends asking in the site's `#wiki-help` Discord channel when assistance is needed.

## Proposed page name

`PS2:OPL Linux Toolbox`

## Proposed introduction

**OPL Linux Toolbox** is an open-source Linux desktop application for organizing and maintaining game libraries used with Open PS2 Loader (OPL). It is based on OrbitOPL Toolbox and focuses on Linux storage integration, safe file operations and native Linux distribution packages.

The application can work with PS2 DVD/CD libraries, PS1/POPS content and APPS/ELF entries, along with OPL artwork, per-game CFG files and virtual memory cards. It is distributed under the GNU General Public License v3.0.

## Features

1. **Library management** — Browse PS2 DVD/CD, PS1/POPS and APPS/ELF content from an OPL library directory.
2. **Game importing** — Import ISO, ZSO, CUE/BIN and ELF files with queued progress and Game ID handling.
3. **Safe file operations** — Use temporary `.part` files during transfers, with optional SHA-256 verification and targeted rollback on supported operations.
4. **FAT32 support** — Handle UL/USBExtreme installation workflows for PS2 images that cannot be stored as a single file on FAT32.
5. **Artwork** — Download and repair compatible OPL artwork for library entries.
6. **Per-game configuration** — Manage CFG data used by OPL.
7. **Virtual Memory Cards** — Manage VMC files associated with an OPL library.
8. **Linux storage integration** — Discover mounted storage, inspect filesystem/capacity information and safely unmount supported devices.
9. **Linux packages** — Releases are provided as AppImage, `.deb`, `.rpm` and Arch/Pacman packages with SHA-256 checksum files.

## Installation

The project provides a one-command installer for supported 64-bit Linux distributions:

```bash
curl -fsSL https://raw.githubusercontent.com/lucasonline0/opl-linux-toolbox/main/install.sh | bash
```

The installer retrieves the latest stable GitHub Release, verifies the published checksum and selects a package appropriate for the detected distribution when possible.

Users can also download release packages manually from the project's GitHub Releases page.

### Package formats

| Distribution | Format |
| --- | --- |
| Debian / Ubuntu / Mint | `.deb` |
| Fedora / openSUSE | `.rpm` |
| Arch-based distributions | `.pacman` |
| Other supported 64-bit Linux distributions | AppImage |

## Basic usage

1. Launch OPL Linux Toolbox.
2. Select an existing OPL library directory or mounted storage device.
3. Allow the application to scan the standard OPL folders.
4. Use the Library and Import sections to manage entries.
5. Artwork, CFG, VMC and maintenance functions are available from their corresponding sections in the application.

The application does not provide commercial game downloads and does not require formatting a storage device.

## OPL directory layout

```text
OPL_ROOT/
├── CD/ DVD/        PS2 images (.iso/.zso)
├── VCD/ POPS/      PS1 content and POPStarter launchers
├── APPS/           ELF applications
├── ART/            artwork
├── CFG/            per-game configuration
└── VMC/            virtual memory cards
```

## Project history

OPL Linux Toolbox is based on **OrbitOPL Toolbox** by Luden02. The upstream project and contributor history are credited by the project, and the derivative remains distributed under GPL-3.0.

The Linux-focused project adds distribution packaging and Linux-specific storage/safety workflows while retaining OPL library-management functionality inherited and evolved from the upstream application.

## External links

- Project repository: `https://github.com/lucasonline0/opl-linux-toolbox`
- Releases: `https://github.com/lucasonline0/opl-linux-toolbox/releases`
- Upstream OrbitOPL Toolbox: `https://github.com/Luden02/OrbitOPL-Toolbox`

## Suggested submission process

1. Review the draft against the current application release before posting.
2. Create or request the page under the `PS2:` namespace.
3. Keep wording encyclopedic rather than promotional.
4. Link the page from the PS2 PC Utilities section only if ConsoleMods editors consider it appropriate.
5. If uncertain about structure or notability, ask in ConsoleMods' `#wiki-help` channel before publishing.
