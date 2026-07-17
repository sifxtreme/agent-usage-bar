# claude-usage-bar

Your Claude Code **5-hour** and **weekly** usage limits, stacked in the macOS menu bar.

<p align="center"><img src="docs/menubar.png" alt="5h and weekly usage stacked in the macOS menu bar" width="160"></p>

Two crisp lines, always visible. No credentials, no undocumented APIs — it reads the **official** rate-limit data Claude Code already hands to its statusline.

---

## How it works

Claude Code passes a JSON payload to its statusline command on every render, and that payload includes [`rate_limits.five_hour` and `rate_limits.seven_day`](https://code.claude.com/docs/en/statusline). The tool is two halves — a **writer** and a **reader** — joined by a local snapshot file:

```
┌─────────────┐  rate_limits   ┌──────────────┐   reads    ┌─────────────────────┐
│ Claude Code  │ ─stdin JSON─▶ │  hook writes │ ─────────▶ │ native menu-bar app │
│ statusline   │               │  a snapshot  │            │  (or SwiftBar)      │
└─────────────┘               │  (~/.claude) │            └─────────────────────┘
                               └──────────────┘
```

- **`claude-usage-bar hook`** is your statusline command. It reads the payload and writes an atomic `0600` snapshot. No network call — the numbers are a free byproduct of Claude rendering its statusline.
- A **reader** displays the snapshot. Two options ship here:
  1. **Native menu-bar app** (recommended) — a ~150-line Swift `NSStatusItem` that shows the two percentages as real, crisp two-line text. No extra dependencies.
  2. **SwiftBar plugin** — if you already run [SwiftBar](https://github.com/swiftbar/SwiftBar).

**Why a snapshot instead of an API?** The usage numbers only reach your machine through the statusline payload — there's no public usage endpoint. Reading Claude Code's OAuth token to hit an internal endpoint would be fragile and is arguably scripted access under Anthropic's [Consumer Terms](https://www.anthropic.com/legal/consumer-terms). This tool avoids that. The tradeoff: the bar refreshes **while a Claude Code session is running**; otherwise it shows the last-known value (marked stale after 3h), which is fine — your usage isn't changing then anyway.

## Requirements

- macOS, Node.js 18+ (you already have it — Claude Code needs it)
- For the native app: the Swift toolchain (`swiftc`, included with Xcode Command Line Tools: `xcode-select --install`)
- Claude Code recent enough to send `rate_limits` in the statusline payload (check with `claude-usage-bar doctor`)

## Install (native app — recommended)

```bash
git clone https://github.com/asifahmed/claude-usage-bar
cd claude-usage-bar
npm link            # puts `claude-usage-bar` on your PATH (the writer)

# 1) Point Claude Code's statusline at the hook — ~/.claude/settings.json:
#    "statusLine": { "type": "command", "command": "claude-usage-bar hook --quiet" }
#    (--quiet writes the snapshot without printing a line in your Claude UI)

# 2) Build + install the native menu-bar app (compiles, adds a LaunchAgent):
./native/install.sh

# 3) Start a Claude Code session so the first snapshot is written.
claude-usage-bar doctor    # verify everything is wired
```

Tune the vertical position with `CLAUDE_USAGE_BAR_TOP_PAD` (default `4.0`) in the LaunchAgent, or edit the constants at the top of `native/ClaudeUsageMenuBar.swift`. Remove it all with `./native/install.sh uninstall`.

## Install (SwiftBar plugin — alternative)

If you'd rather use SwiftBar, skip step 2 above and instead:

```bash
brew install --cask swiftbar
mkdir -p ~/.swiftbar && cp plugins/claude-usage.1h.sh ~/.swiftbar/
defaults write com.ameba.SwiftBar PluginDirectory "$HOME/.swiftbar"
open -a SwiftBar
```

The plugin refreshes hourly, on click, and via a Refresh menu item — all reading the local snapshot (zero API calls). Its `stack` style needs [ImageMagick](https://imagemagick.org) (`brew install imagemagick`) to render two rows; without it, it falls back to a single line.

## Configuration

Environment variables (native app reads `SNAPSHOT`, `STALE_MINUTES`, `ALERT_COLOR`, `TOP_PAD`; the SwiftBar reader reads the rest):

| Variable | Default | Meaning |
|---|---|---|
| `CLAUDE_USAGE_BAR_SNAPSHOT` | `~/.claude/usage-bar/usage.json` | Where the snapshot is stored |
| `CLAUDE_USAGE_BAR_STALE_MINUTES` | `180` | Age after which the reading is marked stale |
| `CLAUDE_USAGE_BAR_TOP_PAD` | `4.0` | Native app: pixels of top padding for the two rows |
| `CLAUDE_USAGE_BAR_ALERT_COLOR` | (off) | If set, text turns red when a limit hits 80% |
| `CLAUDE_USAGE_BAR_STYLE` | `numbers` | SwiftBar reader: `numbers`, `bars`, or `stack` |
| `CLAUDE_USAGE_BAR_COLOR` / `_FONT` / `_FONT_SIZE` | | SwiftBar reader text styling |
| `CLAUDE_USAGE_BAR_BIN` | (auto) | Explicit CLI path for the SwiftBar plugin |

## Commands

```
claude-usage-bar hook [--quiet | --wrap "<cmd>"]   statusLine hook (writes the snapshot)
claude-usage-bar render                            SwiftBar/xbar output
claude-usage-bar doctor                            check setup + health
claude-usage-bar path                              print the snapshot path
```

## Development

```bash
npm run check   # typecheck (tsc --checkJs) + tests (node --test)
```

The writer/CLI is zero-dependency, buildless ESM (type-checked via JSDoc). The native app is a single Swift file.

## Credits

Data-source approach informed by [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud), which surfaces the same `rate_limits` payload inside the statusline itself. This project's niche is getting those two numbers *out* of the session and into the always-visible menu bar.

## License

MIT © Asif Ahmed
