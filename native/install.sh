#!/usr/bin/env bash
# Build the native menu-bar app and install it as a LaunchAgent (runs now + at
# login). Re-run any time to rebuild. `./install.sh uninstall` removes it.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="$REPO/bin-native/claude-usage-menubar"
LABEL="com.claude-usage-bar.menubar"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

if [ "${1:-}" = "uninstall" ]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Removed $LABEL. (binary left at $BIN)"
  exit 0
fi

echo "Building…"
mkdir -p "$REPO/bin-native"
swiftc -O "$REPO/native/ClaudeUsageMenuBar.swift" -o "$BIN"

echo "Installing LaunchAgent…"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$BIN</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>Crashed</key><true/></dict>
  <key>ProcessType</key><string>Interactive</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "Done — look at your menu bar. (uninstall: ./native/install.sh uninstall)"
