#!/usr/bin/env bash
# Installs the native helper that lets "Ask Dia" open Dia's side chat (⌘E).
# Usage: native/install.sh            install or update
#        native/install.sh --uninstall
set -euo pipefail

HOST_NAME="com.diapalette.helper"
EXTENSION_ID="dhaljlfbeljgnkhgnhjdigkepfpblbme" # pinned by "key" in manifest.json
HOST_DIR="$HOME/Library/Application Support/Dia/User Data/NativeMessagingHosts"
INSTALL_DIR="$HOME/Library/Application Support/DiaCommandPalette"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ "${1:-}" == "--uninstall" ]]; then
  rm -f "$HOST_DIR/$HOST_NAME.json"
  rm -rf "$INSTALL_DIR"
  echo "Removed the Dia Command Palette helper."
  exit 0
fi

PYTHON="$(command -v python3)" || {
  echo "python3 is required (install Xcode Command Line Tools or Homebrew python)." >&2
  exit 1
}

mkdir -p "$HOST_DIR" "$INSTALL_DIR"

# Dia starts the host with a minimal PATH, so pin the interpreter in the shebang.
HELPER="$INSTALL_DIR/dia_palette_helper.py"
{
  echo "#!$PYTHON"
  tail -n +2 "$SRC_DIR/dia_palette_helper.py"
} >"$HELPER"
chmod 755 "$HELPER"

cat >"$HOST_DIR/$HOST_NAME.json" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Opens Dia's side chat for Dia Command Palette",
  "path": "$HELPER",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXTENSION_ID/"]
}
EOF

echo "Installed helper to $HELPER"
echo "Registered $HOST_DIR/$HOST_NAME.json"
echo
echo "The first Ask Dia will ask to let Dia control your computer:"
echo "allow Dia in System Settings → Privacy & Security → Accessibility."
