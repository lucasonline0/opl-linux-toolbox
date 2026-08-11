#!/usr/bin/env bash
set -euo pipefail

REPO="lucasonline0/opl-linux-toolbox"
API_URL="https://api.github.com/repos/${REPO}/releases?per_page=100"
APP_ID="io.github.lucasonline0.opl-linux-toolbox"
TMP_DIR="$(mktemp -d -t opl-linux-toolbox-install.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

die() { printf 'OPL Linux Toolbox: %s\n' "$*" >&2; exit 1; }
require_cmd() { command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"; }
require_cmd curl
require_cmd sha256sum
require_cmd python3

case "$(uname -m)" in
  x86_64|amd64) ;;
  *) die "only x86_64/amd64 is supported by this release" ;;
esac

. /etc/os-release 2>/dev/null || true
DISTRO_ID="${ID:-unknown}"
DISTRO_LIKE="${ID_LIKE:-}"
PACKAGE_KIND="appimage"
case "${DISTRO_ID}:${DISTRO_LIKE}" in
  ubuntu:*|debian:*|linuxmint:*|elementary:*|pop:*) PACKAGE_KIND="deb" ;;
  fedora:*|rhel:*|centos:*|rocky:*|alma:*|*:fedora*|*:rhel*) PACKAGE_KIND="rpm" ;;
  opensuse*:*|suse:*|*:suse*) PACKAGE_KIND="rpm" ;;
  arch:*|manjaro:*|endeavouros:*|*:arch*) PACKAGE_KIND="pacman" ;;
esac

curl -fsSL --proto '=https' --tlsv1.2 --max-redirs 5 "$API_URL" -o "$TMP_DIR/releases.json" \
  || die "could not query GitHub Releases"

RELEASE_INFO="$(python3 - "$TMP_DIR/releases.json" "$PACKAGE_KIND" <<'PY'
import json, re, sys
from urllib.parse import urlparse

path, kind = sys.argv[1:]
releases = json.load(open(path, encoding="utf-8"))
releases = [r for r in releases if not r.get("draft") and not r.get("prerelease")]
if not releases:
    raise SystemExit("no stable release is available")
release = max(releases, key=lambda r: r.get("published_at") or r.get("created_at") or "")
patterns = {
    "deb": re.compile(r"\.deb$", re.I),
    "rpm": re.compile(r"\.rpm$", re.I),
    "pacman": re.compile(r"(\.pkg\.tar\.(zst|xz)|\.pacman)$", re.I),
    "appimage": re.compile(r"\.appimage$", re.I),
}
assets = release.get("assets", [])
asset = next((a for a in assets if patterns[kind].search(a.get("name", ""))), None)
if asset is None and kind == "pacman":
    asset = next((a for a in assets if patterns["appimage"].search(a.get("name", ""))), None)
if asset is None:
    raise SystemExit(f"no {kind} or fallback AppImage asset in the latest stable release")
sums = next((a for a in assets if a.get("name") == "SHA256SUMS"), None)
if sums is None:
    raise SystemExit("latest release does not provide SHA256SUMS")
for key in ("browser_download_url",):
    for value in (asset.get(key), sums.get(key)):
        parsed = urlparse(value or "")
        if parsed.scheme != "https" or parsed.netloc != "github.com" or not parsed.path.startswith("/lucasonline0/opl-linux-toolbox/releases/"):
            raise SystemExit("release contained an unexpected download host")
print("\t".join((release["tag_name"], asset["name"], asset["browser_download_url"], sums["browser_download_url"])))
PY
)" || die "could not find a compatible stable release: ${RELEASE_INFO}"
IFS=$'\t' read -r RELEASE_TAG ASSET_NAME ASSET_URL SUMS_URL <<< "$RELEASE_INFO"

case "$ASSET_NAME" in
  */*|*..*|*"$'\n'"*) die "unsafe release asset name" ;;
esac
ARTIFACT="$TMP_DIR/$ASSET_NAME"
curl -fL --proto '=https' --tlsv1.2 --max-redirs 5 "$ASSET_URL" -o "$ARTIFACT" \
  || die "failed to download release asset"
curl -fL --proto '=https' --tlsv1.2 --max-redirs 5 "$SUMS_URL" -o "$TMP_DIR/SHA256SUMS" \
  || die "failed to download SHA256SUMS"

EXPECTED="$(python3 - "$TMP_DIR/SHA256SUMS" "$ASSET_NAME" <<'PY'
import re, sys
digest_file, name = sys.argv[1:]
for line in open(digest_file, encoding="utf-8", errors="replace"):
    parts = line.strip().split()
    if len(parts) >= 2 and re.fullmatch(r"[0-9a-fA-F]{64}", parts[0]) and parts[-1].lstrip("*") in (name, "./" + name):
        print(parts[0].lower())
        break
PY
)" || true
[[ "$EXPECTED" =~ ^[0-9a-f]{64}$ ]] || die "SHA256SUMS has no entry for $ASSET_NAME"
ACTUAL="$(sha256sum "$ARTIFACT" | awk '{print tolower($1)}')"
[[ "$ACTUAL" == "$EXPECTED" ]] || die "checksum verification failed for $ASSET_NAME"

echo "Installing OPL Linux Toolbox ${RELEASE_TAG} (${ASSET_NAME})..."
case "$ASSET_NAME" in
  *.deb)
    command -v sudo >/dev/null 2>&1 || die "sudo is required to install a Debian package"
    sudo apt-get install -y "$ARTIFACT"
    ;;
  *.rpm)
    command -v sudo >/dev/null 2>&1 || die "sudo is required to install an RPM package"
    if command -v dnf >/dev/null 2>&1; then sudo dnf install -y "$ARTIFACT"; elif command -v zypper >/dev/null 2>&1; then sudo zypper --non-interactive install "$ARTIFACT"; else die "dnf or zypper is required for RPM installation"; fi
    ;;
  *.pkg.tar.*|*.pacman)
    command -v sudo >/dev/null 2>&1 || die "sudo is required to install a pacman package"
    sudo pacman -U --noconfirm "$ARTIFACT"
    ;;
  *.AppImage|*.appimage)
    APP_DIR="$HOME/.local/share/opl-linux-toolbox"
    BIN_DIR="$HOME/.local/bin"
    DATA_DIR="$HOME/.local/share"
    DESKTOP_DIR="$DATA_DIR/applications"
    ICON_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"
    mkdir -p "$APP_DIR" "$BIN_DIR" "$DESKTOP_DIR" "$ICON_DIR"
    install -m 0755 "$ARTIFACT" "$APP_DIR/opl-linux-toolbox.AppImage"
    ln -sfn "$APP_DIR/opl-linux-toolbox.AppImage" "$BIN_DIR/opl-linux-toolbox"
    ICON_PATH="$APP_DIR/opl-linux-toolbox.AppImage"
    EXTRACT_DIR="$TMP_DIR/appimage-extract"
    mkdir -p "$EXTRACT_DIR"
    if (cd "$EXTRACT_DIR" && "$APP_DIR/opl-linux-toolbox.AppImage" --appimage-extract >/dev/null 2>&1); then
      FOUND_ICON="$(find "$EXTRACT_DIR/squashfs-root/usr/share/icons" -type f -iname '*.png' 2>/dev/null | sort | head -n 1 || true)"
      if [[ -n "$FOUND_ICON" ]]; then install -m 0644 "$FOUND_ICON" "$ICON_DIR/opl-linux-toolbox.png"; ICON_PATH="$ICON_DIR/opl-linux-toolbox.png"; fi
    fi
    cat > "$DESKTOP_DIR/${APP_ID}.desktop" <<EOF
[Desktop Entry]
Name=OPL Linux Toolbox
Comment=Manage Open PS2 Loader libraries on Linux
Exec=$BIN_DIR/opl-linux-toolbox %U
Icon=$ICON_PATH
Terminal=false
Type=Application
Categories=Utility;Game;
StartupWMClass=opl-linux-toolbox
EOF
    command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true
    ;;
  *) die "unsupported release asset: $ASSET_NAME" ;;
esac
echo "OPL Linux Toolbox installed successfully. It is available from your desktop application menu."
