# claude-usage-bar

Your Claude Code **5-hour** and **weekly** usage limits, at a glance in the macOS menu bar.

```
  5h 9% · wk 22%     ← in your menu bar, colored green → amber (≥50%) → red (≥80%)
```

Click it for reset times and staleness. No credentials, no undocumented APIs — it reads the **official** rate-limit data that Claude Code already hands to its statusline.

---

## How it works

Claude Code passes a JSON payload to its statusline command on every render, and (as of recent versions) that payload includes [`rate_limits.five_hour` and `rate_limits.seven_day`](https://code.claude.com/docs/en/statusline). This tool has two halves:

```
┌─────────────────┐   rate_limits    ┌──────────────┐   reads    ┌──────────────┐
│  Claude Code     │ ───stdin JSON──▶ │  hook writes │ ─────────▶ │  SwiftBar    │
│  statusline      │                  │  a snapshot  │            │  menu bar    │
└─────────────────┘                  │  (~/.claude) │            └──────────────┘
                                      └──────────────┘
```

1. **`claude-usage-bar hook`** is your statusline command. It reads the payload, writes an atomic `0600` snapshot file, and prints a compact usage line.
2. **`claude-usage-bar render`** reads that snapshot and prints [SwiftBar](https://github.com/swiftbar/SwiftBar)/xbar-formatted output. The bundled plugin calls it hourly.

**Why a snapshot instead of an API?** The usage numbers only reach *your machine* through the statusline payload — there's no public usage endpoint. Reading Claude Code's OAuth token from the Keychain to hit an internal endpoint would be fragile and is arguably scripted access under Anthropic's [Consumer Terms](https://www.anthropic.com/legal/consumer-terms). This tool deliberately avoids that. The tradeoff: **the bar refreshes while a Claude Code session is running**; when you're not in a session it shows the last-known value (annotated stale after 3h), which is fine because your usage isn't changing then anyway.

## Requirements

- macOS with [SwiftBar](https://github.com/swiftbar/SwiftBar) (`brew install --cask swiftbar`) or xbar
- Node.js 18+ (you already have it — Claude Code needs it)
- Claude Code recent enough to send `rate_limits` in the statusline payload (check with `claude-usage-bar doctor` after your first session)

## Install

```bash
git clone https://github.com/asifahmed/claude-usage-bar
cd claude-usage-bar
npm link            # puts `claude-usage-bar` on your PATH

# 1) Point Claude Code's statusline at the hook (~/.claude/settings.json):
#    "statusLine": { "type": "command", "command": "claude-usage-bar hook" }
#    (use `claude-usage-bar hook --quiet` if you don't want the line in your Claude UI)

# 2) Install SwiftBar and drop in the plugin:
brew install --cask swiftbar
mkdir -p ~/.swiftbar && cp plugins/claude-usage.1h.sh ~/.swiftbar/
defaults write com.ameba.SwiftBar PluginDirectory "$HOME/.swiftbar"
open -a SwiftBar

# 3) Start a Claude Code session so the first snapshot gets written, then:
claude-usage-bar doctor
```

## Configuration

All via environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `CLAUDE_USAGE_BAR_SNAPSHOT` | `~/.claude/usage-bar/usage.json` | Where the snapshot is stored |
| `CLAUDE_USAGE_BAR_STALE_MINUTES` | `180` | Age after which the bar is marked stale |
| `CLAUDE_USAGE_BAR_BIN` | (auto) | Explicit CLI path for the SwiftBar plugin |
| `CLAUDE_USAGE_BAR_STYLE` | `numbers` | `numbers` (`5H18 WK23`), `bars` (`5H[##-] WK[#--]`), or `stack` (two rows) |
| `CLAUDE_USAGE_BAR_COLOR` | `white` | Any SwiftBar color, or `auto` to let the menu bar decide |
| `CLAUDE_USAGE_BAR_ALERT_COLOR` | (off) | If set, text turns red when a limit hits 80% |
| `CLAUDE_USAGE_BAR_FONT` / `_FONT_SIZE` | `Menlo` / `11` | Menu-bar font (text styles) |
| `CLAUDE_USAGE_BAR_FONT_SIZE`… | | see above |

### Menu-bar styles

- **`numbers`** (default) — compact single line, `5H18 WK23`.
- **`bars`** — ASCII HP meters, `5H[##--] WK[#---]`.
- **`stack`** — the two percentages on **two rows** (`5h 18%` / `wk 23%`), rendered as a
  template image so it auto-colors to your menu bar. **Requires [ImageMagick](https://imagemagick.org)**
  (`brew install imagemagick`); without it, `stack` falls back to the `numbers` line automatically.
  The bundled plugin defaults to `stack`.

Refresh cadence is the plugin filename: `claude-usage.1h.sh` = hourly. Rename to `.15m.sh`, `.30m.sh`, etc. The dropdown **Refresh** item forces an update any time.

### Already have a statusline?

Use `--wrap` so your existing statusline still renders while the snapshot is written as a side effect:

```json
"statusLine": { "type": "command", "command": "claude-usage-bar hook --wrap 'your-existing-statusline'" }
```

Or use `--quiet` and keep your statusline command separate (whichever runs, this one just needs to see the payload).

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

Zero runtime dependencies. Buildless ESM — the source runs directly under Node; TypeScript is used only to type-check the JSDoc-annotated `.js`.

## Credits

Data-source approach informed by [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud), which surfaces the same `rate_limits` payload inside the statusline itself. This project's niche is getting those two numbers *out* of the session and into the always-visible menu bar.

## License

MIT © Asif Ahmed
