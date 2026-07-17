#!/usr/bin/env bash
# <xbar.title>Claude Code Usage</xbar.title>
# <xbar.version>v0.1.0</xbar.version>
# <xbar.author>Asif Ahmed</xbar.author>
# <xbar.desc>5-hour and weekly Claude Code usage limits in the menu bar. Reads a snapshot written by the official statusline payload — no credentials.</xbar.desc>
# <xbar.dependencies>node,agent-usage-bar</xbar.dependencies>
# <swiftbar.refreshOnOpen>true</swiftbar.refreshOnOpen>
#
# SwiftBar/xbar plugin. Refreshes three ways:
#   - hourly      (the ".1h." in the filename)
#   - on click    (<swiftbar.refreshOnOpen> re-reads the snapshot when you open the menu)
#   - on demand   (the dropdown's "Refresh" item)
# This wrapper just calls `agent-usage-bar render`, which reads the local
# snapshot (no network, no credentials).

export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:/usr/bin:/bin:$PATH"

# Stacked two-row menu-bar image (needs ImageMagick `magick`); falls back to a
# single text line automatically if magick is missing. Override by exporting
# AGENT_USAGE_BAR_STYLE=numbers (or bars) before SwiftBar launches.
export AGENT_USAGE_BAR_STYLE="${AGENT_USAGE_BAR_STYLE:-stack}"

# Resolve the CLI: explicit override, then PATH, then a common repo checkout.
BIN="${AGENT_USAGE_BAR_BIN:-}"
if [ -z "$BIN" ]; then
  if command -v agent-usage-bar >/dev/null 2>&1; then
    BIN="$(command -v agent-usage-bar)"
  elif [ -x "$HOME/code/experiments/agent-usage-bar/bin/agent-usage-bar.js" ]; then
    BIN="$HOME/code/experiments/agent-usage-bar/bin/agent-usage-bar.js"
  fi
fi

if [ -z "$BIN" ]; then
  echo "CC usage ⚠️"
  echo "---"
  echo "agent-usage-bar not found on PATH"
  echo "Set AGENT_USAGE_BAR_BIN or run 'npm link' in the repo | size=11"
  exit 0
fi

exec "$BIN" render
