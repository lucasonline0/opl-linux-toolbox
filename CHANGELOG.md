# Changelog

All notable user-facing changes to **OPL Linux Toolbox** are documented here.

The project follows semantic versioning where practical. GitHub Releases remain the canonical source for downloadable packages.

## [Unreleased]

### Planned

- Continue improving Linux storage integration, library diagnostics and OPL-aware workflows.

## [1.4.0] - 2026-08-12

### Highlights

- Added real in-app update progress from download through SHA-256 verification, package installation and automatic restart.
- Reorganized the sidebar into clearer **Library**, **Assets** and **Tools** groups.
- Improved Artwork health reporting with attention filtering and missing-asset counts.
- Fixed Artwork **Repair** so it downloads only missing assets instead of unnecessarily refreshing every remote asset.
- Improved VMC management with presets, search, allocation summaries and clearer OPL assignment guidance.
- Added per-game OPL CFG editing directly from game details.
- Added compatibility mode toggles while preserving unrelated and unknown CFG keys.
- Added VMC slot 0 / slot 1 assignment from existing virtual memory cards.
- Improved the dashboard with refreshable maintenance status and direct health/artwork/VMC actions.
- Added CI validation for Angular, Electron and core tests before merging changes.
- Updated the release workflow so a version bump merged to `main` can publish the matching Linux release automatically.

### Safety

- Existing unknown CFG keys are preserved when compatibility or VMC settings are saved.
- Update downloads remain restricted to GitHub release hosts and are SHA-256 verified before installation.
- Failed update downloads are cleaned from the temporary directory and do not trigger a restart.

### Distribution

Linux release assets are generated for:

- AppImage
- Debian / Ubuntu (`.deb`)
- Fedora / openSUSE (`.rpm`)
- Arch-based distributions (`.pacman`)
- `SHA256SUMS`

## [1.3.9] - 2026-08-11

### Highlights

- Established the Linux-first identity and distribution flow for OPL Linux Toolbox.
- Added native Linux release packages for Debian/Ubuntu (`.deb`), Fedora/openSUSE (`.rpm`), Arch-based distributions (`.pacman`) and portable AppImage.
- Added SHA-256 checksums to published release assets.
- Added a one-command installer that selects the appropriate Linux package and verifies downloads.
- Refreshed the application branding and blue-focused interface.
- Added application screenshots to the repository documentation.
- Corrected Arch package dependency handling.
- Added verified update/release infrastructure for Linux packages.

### Distribution

Release assets include:

- `opl-linux-toolbox-1.3.9-x86_64.AppImage`
- `opl-linux-toolbox-1.3.9-x86_64.deb`
- `opl-linux-toolbox-1.3.9-x86_64.rpm`
- `opl-linux-toolbox-1.3.9-x86_64.pacman`
- `SHA256SUMS`

[1.4.0]: https://github.com/lucasonline0/opl-linux-toolbox/releases/tag/v1.4.0
[1.3.9]: https://github.com/lucasonline0/opl-linux-toolbox/releases/tag/v1.3.9
