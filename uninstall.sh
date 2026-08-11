#!/usr/bin/env bash
set -euo pipefail

APP_ID="io.github.lucasonline0.opl-linux-toolbox"
removed=0

if command -v dpkg-query >/dev/null 2>&1 && dpkg-query -W -f='${Status}' opl-linux-toolbox 2>/dev/null | grep -q 'install ok installed'; then
  command -v sudo >/dev/null 2>&1 || { echo "sudo is required to remove the Debian package" >&2; exit 1; }
  sudo apt-get remove -y opl-linux-toolbox
  removed=1
fi
if command -v rpm >/dev/null 2>&1 && rpm -q opl-linux-toolbox >/dev/null 2>&1; then
  command -v sudo >/dev/null 2>&1 || { echo "sudo is required to remove the RPM package" >&2; exit 1; }
  if command -v dnf >/dev/null 2>&1; then sudo dnf remove -y opl-linux-toolbox; else sudo zypper --non-interactive remove opl-linux-toolbox; fi
  removed=1
fi
if command -v pacman >/dev/null 2>&1 && pacman -Q opl-linux-toolbox >/dev/null 2>&1; then
  command -v sudo >/dev/null 2>&1 || { echo "sudo is required to remove the pacman package" >&2; exit 1; }
  sudo pacman -R --noconfirm opl-linux-toolbox
  removed=1
fi

# Remove only files created by the per-user AppImage installer. User data and
# configuration under ~/.config are intentionally retained.
rm -f "$HOME/.local/bin/opl-linux-toolbox" \
  "$HOME/.local/share/applications/${APP_ID}.desktop" \
  "$HOME/.local/share/icons/hicolor/256x256/apps/opl-linux-toolbox.png"
if [[ -d "$HOME/.local/share/opl-linux-toolbox" ]]; then
  rm -rf -- "$HOME/.local/share/opl-linux-toolbox"
  removed=1
fi
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true

if (( removed == 0 )); then
  echo "OPL Linux Toolbox installation was not found. User data was not changed."
else
  echo "OPL Linux Toolbox was removed. User data and configuration were kept."
fi
