# Linux installation and troubleshooting

The recommended installation method is the checksum-verified installer:

```bash
curl -fsSL https://raw.githubusercontent.com/lucasonline0/opl-linux-toolbox/main/install.sh | bash
```

The installer detects the distribution, downloads the latest stable release, verifies it against `SHA256SUMS`, and installs the native package when one is available. Running OPL Linux Toolbox itself does **not** require `sudo`.

## Manual installation

Download the package and `SHA256SUMS` from the same GitHub release before using one of the commands below. Published Linux packages are currently x86_64.

### Debian, Ubuntu, Linux Mint, Pop!_OS and derivatives

```bash
sudo apt install ./opl-linux-toolbox-<version>-x86_64.deb
```

### Fedora, RHEL-family distributions

```bash
sudo dnf install ./opl-linux-toolbox-<version>-x86_64.rpm
```

### openSUSE

```bash
sudo zypper install ./opl-linux-toolbox-<version>-x86_64.rpm
```

### Arch Linux, Manjaro, EndeavourOS and derivatives

```bash
sudo pacman -U ./opl-linux-toolbox-<version>-x86_64.pacman
```

### AppImage

The AppImage does not need a system-wide installation:

```bash
chmod +x ./opl-linux-toolbox-<version>-x86_64.AppImage
./opl-linux-toolbox-<version>-x86_64.AppImage
```

If the shell reports `Permission denied`, run the `chmod +x` command once and try again. Keep the AppImage on a filesystem mounted with execution allowed; a `noexec` mount can prevent AppImages from starting even when the executable bit is set.

## Verify a manual download

Place the downloaded package and `SHA256SUMS` in the same directory, then run:

```bash
sha256sum -c SHA256SUMS --ignore-missing
```

The selected package must report `OK`. Do not install or run a package whose checksum fails.

To verify one file explicitly:

```bash
grep 'opl-linux-toolbox-<version>-x86_64' SHA256SUMS | sha256sum -c -
```

## Common problems

### The app does not appear in the application menu

Native DEB/RPM/Pacman packages install a desktop entry. If a desktop environment has not refreshed it yet, log out and back in or launch the executable directly from a terminal:

```bash
opl-linux-toolbox
```

The one-command installer also creates a user-local launcher when it falls back to AppImage. Ensure `$HOME/.local/bin` is in `PATH` if you want to start it by command name.

### AppImage cannot start from a USB drive

First confirm it is executable:

```bash
chmod +x ./opl-linux-toolbox-<version>-x86_64.AppImage
```

If it still fails and the drive is mounted with `noexec`, copy the AppImage to a normal local directory such as `~/Applications` or use the recommended installer. Do not remount a shared or managed filesystem just to run the application.

### Package manager reports missing dependencies

Use the native package manager command shown above rather than manually extracting the package. It resolves the dependencies declared by the release package. On an unsupported distribution, use the AppImage fallback.

### The installer chooses AppImage instead of a native package

This is intentional for distributions that the installer cannot safely classify. The AppImage is installed under the current user's home directory and does not require root privileges to run.

## Supported release formats

The Linux release workflow publishes DEB, RPM, Pacman and AppImage artifacts together with `SHA256SUMS`. The project never formats an OPL storage device as part of installation.
