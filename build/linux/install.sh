#!/usr/bin/env bash
# Installs pg-pilot into the current user's XDG dirs so it shows up in the
# desktop app launcher. No root required.
#
# Works two ways:
#   - from a repo checkout, after `wails build`
#   - from an extracted release tarball (binary/icon/.desktop next to this script)
set -euo pipefail
cd "$(dirname "$0")"

if [ -f "../bin/pg-pilot" ]; then
  BIN_SRC="../bin/pg-pilot"
  ICON_SRC="../appicon.png"
  DESKTOP_SRC="pg-pilot.desktop"
else
  BIN_SRC="pg-pilot"
  ICON_SRC="appicon.png"
  DESKTOP_SRC="pg-pilot.desktop"
fi

BIN_DEST="$HOME/.local/bin"
ICON_THEME_DIR="$HOME/.local/share/icons/hicolor"
DESKTOP_DEST="$HOME/.local/share/applications"

[ -f "$BIN_SRC" ] || { echo "run 'wails build' first"; exit 1; }

install -Dm755 "$BIN_SRC" "$BIN_DEST/pg-pilot"
# 256x256 is the most universally-checked app icon size across desktop
# environments; 1024x1024 is kept too for HiDPI/large-icon views.
install -Dm644 "$ICON_SRC" "$ICON_THEME_DIR/1024x1024/apps/pg-pilot.png"
mkdir -p "$ICON_THEME_DIR/256x256/apps"
if command -v magick >/dev/null; then
  magick "$ICON_SRC" -resize 256x256 "$ICON_THEME_DIR/256x256/apps/pg-pilot.png"
else
  install -Dm644 "$ICON_SRC" "$ICON_THEME_DIR/256x256/apps/pg-pilot.png"
fi
install -Dm644 "$DESKTOP_SRC" "$DESKTOP_DEST/pg-pilot.desktop"

command -v update-desktop-database >/dev/null && update-desktop-database "$DESKTOP_DEST" || true
# -t: rebuild even without a user-level index.theme (hicolor's system index covers us)
command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -tf "$ICON_THEME_DIR" || true

echo "installed: $BIN_DEST/pg-pilot"
echo "make sure $BIN_DEST is on your PATH"
