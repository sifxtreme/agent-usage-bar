# agent-usage-bar

Your Claude Code **5-hour** and **weekly** usage limits, stacked in the macOS menu bar.

<p align="center"><img src="docs/menubar.png" alt="5h and weekly usage stacked in the macOS menu bar" width="160"></p>

Two crisp lines, always visible. No credentials, no network calls — it reads the usage data Claude Code already hands to its statusline. See [How it works](docs/HOW_IT_WORKS.md) for the full mechanism.

---

## How it works (30 seconds)

Claude Code passes a JSON payload to its statusline command on every render; that payload includes a `rate_limits` block. A **hook** (registered as your statusline command) parses it and writes a small local **snapshot** file. A menu-bar **reader** displays the snapshot — a native Swift app (recommended) or a SwiftBar plugin.

```
Claude Code statusline ──▶ hook writes ~/.claude/usage-bar/usage.json ──▶ menu-bar reader
```

## Requirements

- macOS.
- **Node.js 18+** — the hook/CLI (the writer) is a Node script. (This is separate from however you installed Claude Code itself.)
- For the native app: the Swift toolchain (`swiftc`) — `xcode-select --install`.
- A **Pro/Max** Claude account: `rate_limits` appears in the statusline payload for subscription accounts, and only after a session's first response.

## Install (native app — recommended)

```bash
git clone https://github.com/sifxtreme/agent-usage-bar
cd agent-usage-bar
npm link                     # puts `agent-usage-bar` on your PATH (the writer)
./native/install.sh          # compiles the app + installs a LaunchAgent (starts now + at login)
```

Then register the hook as your statusline. Edit `~/.claude/settings.json` and **merge** a `statusLine` key into the existing top-level object (here's a minimal complete file):

```json
{
  "statusLine": {
    "type": "command",
    "command": "agent-usage-bar hook --quiet"
  }
}
```

`--quiet` writes the snapshot without printing anything, so your Claude UI is unchanged. **If you already have a statusline**, this replaces it — keep yours by wrapping it instead:

```json
"command": "agent-usage-bar hook --wrap 'your-existing-statusline-command'"
```

Finally, **send one prompt** in a Claude Code session (the first response is when usage first appears), then verify:

```bash
agent-usage-bar doctor
```

Look at the top-right of your menu bar — you should see the two stacked lines.

## Install (SwiftBar plugin — alternative)

Prefer [SwiftBar](https://github.com/swiftbar/SwiftBar)? Skip `./native/install.sh` and instead:

```bash
brew install --cask swiftbar
mkdir -p ~/.swiftbar && cp plugins/agent-usage.1h.sh ~/.swiftbar/
defaults write com.ameba.SwiftBar PluginDirectory "$HOME/.swiftbar"
open -a SwiftBar
```

Refreshes hourly, on click, and via a Refresh menu item — all reading the local snapshot. Its `stack` style needs [ImageMagick](https://imagemagick.org) (`brew install imagemagick`) to render two rows; without it, it falls back to a single line.

## Troubleshooting — the bar shows `--` or nothing

Run `agent-usage-bar doctor` first. Common causes:

- **No first response yet** — start a session and send one prompt; `rate_limits` only appears after Claude responds.
- **Account** — usage limits are reported for Pro/Max accounts, not API-key auth.
- **Hook not wired** — `statusLine.command` in `~/.claude/settings.json` must call `agent-usage-bar hook`. Check the file is valid JSON.
- **`agent-usage-bar` not on PATH** in Claude Code's environment — use an absolute command, e.g. `node /full/path/bin/agent-usage-bar.js hook --quiet`.
- **Old Claude Code** — update it; older versions don't send `rate_limits`.
- **Snapshot path mismatch** — the writer and reader must agree; `agent-usage-bar path` shows where it's read from.
- **Stale** (`◦`/dim) — no session has rendered recently; expected when you're not using Claude.

## macOS Gatekeeper

`./native/install.sh` compiles the app **from source on your machine** — there's no downloaded, signed app bundle. A locally-built binary generally runs without prompts. If macOS ever blocks it, allow it under **System Settings → Privacy & Security → Open Anyway**.

## LaunchAgent behavior

`./native/install.sh` installs `~/Library/LaunchAgents/com.agent-usage-bar.menubar.plist`: it launches the app immediately and at each login, and relaunches it if it crashes. **Quit** from the menu lasts until your next login. The agent points at the compiled binary in your checkout — don't move the repo without re-running the installer.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `AGENT_USAGE_BAR_SNAPSHOT` | `~/.claude/usage-bar/usage.json` | Snapshot location (writer + reader must match) |
| `AGENT_USAGE_BAR_STALE_MINUTES` | `180` | Age after which the reading is marked stale |
| `AGENT_USAGE_BAR_TOP_PAD` | `4.0` | Native app: pixels of top padding for the two rows |
| `AGENT_USAGE_BAR_ALERT_COLOR` | (off) | If set, text turns red when a limit hits 80% |
| `AGENT_USAGE_BAR_STYLE` | `numbers` | SwiftBar reader: `numbers`, `bars`, or `stack` |
| `AGENT_USAGE_BAR_COLOR` / `_FONT` / `_FONT_SIZE` | | SwiftBar reader text styling |

**Where to set these:** a terminal `export` does **not** reach the native app (launched by `launchd`) or SwiftBar (launched by the login session). For the native app, add an `EnvironmentVariables` dict to the LaunchAgent plist (or just edit the constants at the top of `native/AgentUsageMenuBar.swift` and re-run the installer). The hook reads its variables from Claude Code's environment.

## Commands

```
agent-usage-bar hook [--quiet | --wrap "<cmd>"]   statusLine hook (writes the snapshot)
agent-usage-bar doctor                            check setup + health
agent-usage-bar path                              print the snapshot path
agent-usage-bar render                            SwiftBar/xbar output
agent-usage-menubar --once                        print what the native bar would show
```

## Uninstall

```bash
./native/install.sh uninstall     # removes the LaunchAgent + compiled binary
npm unlink -g agent-usage-bar    # removes the CLI from PATH
```

Then remove the `statusLine` key from `~/.claude/settings.json`, and delete the snapshot (`rm "$(agent-usage-bar path)"`) if you want it gone. SwiftBar users: `rm ~/.swiftbar/agent-usage.1h.sh`.

## Privacy

The snapshot holds only two percentages and their reset timestamps — no prompts, transcripts, account identifiers, tokens, or credentials. It's created `0600` in a `0700` directory and never leaves your machine.

## Development

```bash
npm run check   # typecheck (tsc --checkJs) + tests (node --test)
```

The writer/CLI is zero-dependency, buildless ESM (type-checked via JSDoc). The native app is a single Swift file.

## Credits

Data-source approach informed by [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud), which surfaces the same `rate_limits` payload inside the statusline itself. This project's niche is getting those two numbers *out* of the session and into the always-visible menu bar.

## License

MIT © Asif Ahmed
