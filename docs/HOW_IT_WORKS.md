# How it works

`agent-usage-bar` shows your Claude Code **5-hour** and **weekly** usage limits in the macOS menu bar. This doc explains the mechanism, why it's built this way, and how to verify each link yourself.

## The one idea

Claude Code already knows your usage — it sends it to your **statusline** on every render. This tool intercepts that data (a **writer**), saves it to a small file (the **snapshot**), and a menu-bar **reader** displays it. It makes no network calls and reads no credentials.

```
┌──────────────┐  JSON on stdin   ┌──────────────┐   reads file   ┌─────────────────────┐
│ Claude Code   │ ──────────────▶ │ hook (writer) │ ────────────▶ │ menu-bar reader     │
│ statusline    │  on render       │ writes snap   │   snapshot     │ native app / SwiftBar│
└──────────────┘                  └──────────────┘                └─────────────────────┘
```

## Link 1 — Claude Code → the statusline payload

A [statusline command](https://code.claude.com/docs/en/statusline) receives a JSON object on stdin when Claude Code repaints its status line. On a current version, that object includes a `rate_limits` block for subscription (Pro/Max) accounts — and only after the session's **first response** (before that, there's no usage to report). Abridged capture from a live session (other fields elided):

```json
{
  "model": { "display_name": "Opus 4.8" },
  "rate_limits": {
    "five_hour": { "used_percentage": 22, "resets_at": 1784311200 },
    "seven_day": { "used_percentage": 24, "resets_at": 1784736000 }
  }
}
```

The full object also carries `context_window`, `cost`, `cwd`, `session_id`, `transcript_path`, `workspace`, and more; this tool only reads `rate_limits`. Two fields matter:

- `used_percentage` — integer 0–100, how much of the window is consumed.
- `resets_at` — **epoch seconds** when the window rolls over.

> These are a *different shape* from Anthropic's internal `/api/oauth/usage` endpoint (which returns `utilization` and an ISO-8601 `resets_at`). This tool uses the **statusline payload** — documented statusline fields, no credentials, no network. See [Design choice](#design-choice).

## Link 2 — the hook writes a snapshot

`agent-usage-bar hook` is registered as your statusline command (`~/.claude/settings.json`):

```json
"statusLine": { "type": "command", "command": "agent-usage-bar hook --quiet" }
```

On each invocation it parses `rate_limits`, normalizes it (clamps percentages, converts `resets_at` seconds → milliseconds), and **atomically** writes a snapshot to `~/.claude/usage-bar/usage.json` (directory `0700`, file `0600`):

```json
{ "schema": 1, "updatedAt": 1784304941003,
  "fiveHour": 22, "sevenDay": 24,
  "fiveHourResetAt": 1784311200000, "sevenDayResetAt": 1784736000000 }
```

The snapshot contains **only percentages and timestamps** — no prompts, transcripts, account identifiers, tokens, or credentials.

Hardening built into the writer:

- **Atomic**: writes a temp file then `rename()`, so a reader never sees a half-written file.
- **Never clobbers good data with a gap**: if one window is momentarily absent, that field falls back to the previous snapshot; a payload with *no* usable rate limits is skipped entirely (the old snapshot stands).
- **`--quiet`** writes the snapshot and prints nothing, so it doesn't add a line to your Claude Code UI. Omit it to also print a compact line; `--wrap "<cmd>"` runs another statusline command and shows *its* output while still writing the snapshot.

## Link 3 — a reader displays the snapshot

A reader just polls that one file — **no network, no credentials, no coupling to Claude Code internals**.

- **Native app** (`native/AgentUsageMenuBar.swift`, a single Swift file, ~200 lines, no runtime dependencies): an `NSStatusItem` that renders the two percentages as real two-line text, refreshes on a 60s timer and when you open the menu, and adapts its color to a light/dark menu bar. Runs via a LaunchAgent. `agent-usage-menubar --once` prints what it would show and exits.
- **SwiftBar plugin** (`plugins/agent-usage.1h.sh`): calls `agent-usage-bar render`; refreshes hourly, on click, and via a menu item.

## Freshness model

The snapshot advances only when Claude Code renders its statusline (an event-driven, roughly-per-turn thing while you work). When no session is active the reader shows the last written value and marks it stale after 3h (`AGENT_USAGE_BAR_STALE_MINUTES`). Two cases make the last value lag until the next local render: a window **resetting** while you're away, and usage spent on **another device**. Both self-correct on the next render.

## Design choice

Why read the statusline payload instead of an API? Because the numbers arrive there for free, as documented statusline fields, without this tool reading a credential or making a network request. Anthropic's [Consumer Terms](https://www.anthropic.com/legal/consumer-terms) restrict automated access to the service except as permitted; a menu-bar widget polling an internal usage endpoint with your token is exactly the kind of thing best avoided. The statusline route sidesteps all of it.

## Verify it yourself

```bash
agent-usage-bar path                  # where the snapshot lives
cat "$(agent-usage-bar path)"          # the raw snapshot
agent-usage-bar doctor                 # is the hook wired? a reader installed? snapshot fresh?
agent-usage-menubar --once             # what the native menu bar would show, printed
```

This mechanism was validated by (1) capturing the raw statusline payload and confirming `rate_limits` is present with the shape above, (2) cross-checking the written snapshot against the authoritative `/api/oauth/usage` endpoint — they agreed within 1%, the drift being real usage between the two reads — and (3) confirming the native reader's `--once` output equals the snapshot.
