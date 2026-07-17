// agent-usage-bar — a tiny native macOS menu-bar app showing Claude Code AND
// Codex usage limits as two stacked, crisp rows.
//
//   CC 08% 26%      row 1 = Claude Code   (cols: 5-hour, weekly)
//   CX     14%      row 2 = Codex         (weekly only today; 5h auto-fills if it returns)
//
// Both numbers come from data the tools already write locally — no network, no
// credentials. Claude: the statusline snapshot (~/.claude/usage-bar/usage.json,
// written by the `hook`). Codex: the latest `rate_limits` event in the newest
// ~/.codex/sessions/.../rollout-*.jsonl (written every time you run Codex).
//
// Build:  swiftc -O native/AgentUsageMenuBar.swift -o bin-native/agent-usage-menubar

import Cocoa

// MARK: - Shared display model (one row per tool, two columns: 5h + weekly)

struct ToolUsage {
    var label: String            // "CC" / "CX"
    var name: String             // "Claude Code" / "Codex"
    var fivePct: Int?            // 5-hour used %, nil if the window doesn't exist
    var weekPct: Int?            // weekly used %
    var fiveReset: Date?
    var weekReset: Date?
    var updatedAt: Date?
    var note: String?            // e.g. "5h limit removed (Jul 2026)"
}

// MARK: - Claude reader (statusline snapshot)

func snapshotURL() -> URL {
    let env = ProcessInfo.processInfo.environment
    if let o = env["AGENT_USAGE_BAR_SNAPSHOT"], !o.isEmpty {
        return URL(fileURLWithPath: (o as NSString).expandingTildeInPath)
    }
    let home = FileManager.default.homeDirectoryForCurrentUser
    let base = env["CLAUDE_CONFIG_DIR"].flatMap { $0.isEmpty ? nil : URL(fileURLWithPath: $0) }
        ?? home.appendingPathComponent(".claude")
    return base.appendingPathComponent("usage-bar/usage.json")
}

func readClaude() -> ToolUsage? {
    guard let data = try? Data(contentsOf: snapshotURL()),
          let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
    func ms(_ k: String) -> Date? {
        if let n = o[k] as? Double, n > 0 { return Date(timeIntervalSince1970: n / 1000.0) }
        return nil
    }
    func pct(_ k: String) -> Int? {
        if let n = o[k] as? Double { return Int(n.rounded()) }
        if let n = o[k] as? Int { return n }
        return nil
    }
    if pct("fiveHour") == nil && pct("sevenDay") == nil { return nil }
    return ToolUsage(label: "CC", name: "Claude Code",
                     fivePct: pct("fiveHour"), weekPct: pct("sevenDay"),
                     fiveReset: ms("fiveHourResetAt"), weekReset: ms("sevenDayResetAt"),
                     updatedAt: ms("updatedAt"), note: nil)
}

// MARK: - Codex reader (newest session rollout -> last rate_limits event)

func newestCodexRollout() -> String? {
    let p = Process()
    p.executableURL = URL(fileURLWithPath: "/bin/sh")
    p.arguments = ["-c", "ls -t \"$HOME\"/.codex/sessions/*/*/*/rollout-*.jsonl 2>/dev/null | head -1"]
    let out = Pipe()
    p.standardOutput = out
    p.standardError = FileHandle.nullDevice
    try? p.run()
    p.waitUntilExit()
    let s = String(data: out.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?
        .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return s.isEmpty ? nil : s
}

// Pull the last `"rate_limits":{...}` object out of a rollout file (balanced braces).
func lastRateLimits(in path: String) -> [String: Any]? {
    guard let content = try? String(contentsOfFile: path, encoding: .utf8) else { return nil }
    var found: [String: Any]?
    for line in content.split(separator: "\n") where line.contains("\"rate_limits\"") {
        guard let key = line.range(of: "\"rate_limits\"") else { continue }
        let after = line[key.upperBound...]
        guard let start = after.firstIndex(of: "{") else { continue }
        var depth = 0
        var i = start
        var end: String.Index?
        while i < after.endIndex {
            let c = after[i]
            if c == "{" { depth += 1 }
            else if c == "}" { depth -= 1; if depth == 0 { end = after.index(after: i); break } }
            i = after.index(after: i)
        }
        if let e = end,
           let d = String(after[start..<e]).data(using: .utf8),
           let obj = try? JSONSerialization.jsonObject(with: d) as? [String: Any] {
            found = obj
        }
    }
    return found
}

func readCodex() -> ToolUsage? {
    guard let path = newestCodexRollout(), let rl = lastRateLimits(in: path) else { return nil }
    var fivePct: Int?, weekPct: Int?
    var fiveReset: Date?, weekReset: Date?
    for slot in ["primary", "secondary"] {
        guard let w = rl[slot] as? [String: Any] else { continue }
        let wm = (w["window_minutes"] as? Int) ?? Int((w["window_minutes"] as? Double) ?? 0)
        let used = (w["used_percent"] as? Double) ?? Double((w["used_percent"] as? Int) ?? 0)
        let reset = (w["resets_at"] as? Double) ?? (w["resets_at"] as? Int).map(Double.init)
        let date = reset.map { Date(timeIntervalSince1970: $0) }
        if wm == 300 { fivePct = Int(used.rounded()); fiveReset = date }
        else if wm == 10080 { weekPct = Int(used.rounded()); weekReset = date }
    }
    if fivePct == nil && weekPct == nil { return nil }
    // Codex freshness = when the rollout file was last written (i.e. last run).
    let updated = (try? FileManager.default.attributesOfItem(atPath: path)[.modificationDate]) as? Date
    let note = fivePct == nil ? "5h limit removed (Jul 2026); weekly only" : nil
    return ToolUsage(label: "CX", name: "Codex",
                     fivePct: fivePct, weekPct: weekPct,
                     fiveReset: fiveReset, weekReset: weekReset,
                     updatedAt: updated, note: note)
}

// MARK: - Formatting

/// Menu-bar grid cell: "08%", or 3 spaces when the window doesn't exist.
func cell(_ v: Int?) -> String { v.map { String(format: "%02d%%", $0) } ?? "   " }
/// Dropdown percentage: "08%" / "--".
func pctText(_ v: Int?) -> String { v.map { String(format: "%02d%%", $0) } ?? "--" }

func resetText(_ d: Date?) -> String {
    guard let d = d else { return "?" }
    let f = DateFormatter(); f.dateFormat = "EEE h:mm a"
    return f.string(from: d)
}

func ageText(_ d: Date?) -> String {
    guard let d = d else { return "unknown" }
    let m = Int(Date().timeIntervalSince(d) / 60)
    if m < 1 { return "just now" }
    if m < 60 { return "\(m)m ago" }
    let h = m / 60
    return h < 24 ? "\(h)h ago" : "\(h / 24)d ago"
}

let staleMinutes: Int = {
    if let s = ProcessInfo.processInfo.environment["AGENT_USAGE_BAR_STALE_MINUTES"],
       let n = Int(s), n > 0 { return n }
    return 180
}()

func isStale(_ d: Date?) -> Bool {
    guard let d = d else { return true }
    return Date().timeIntervalSince(d) > Double(staleMinutes * 60)
}

// MARK: - App

class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    var timer: Timer?

    func applicationDidFinishLaunching(_ note: Notification) {
        let menu = NSMenu(); menu.delegate = self; statusItem.menu = menu
        if let b = statusItem.button {
            b.lineBreakMode = .byClipping
            if let cell = b.cell as? NSButtonCell {
                cell.wraps = true; cell.usesSingleLineMode = false; cell.lineBreakMode = .byClipping
            }
        }
        render()
        timer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in self?.render() }
    }

    // Two stacked rows, aligned columns, full monospace so labels + digits line up.
    func titleAttr(_ tools: [ToolUsage]) -> NSAttributedString {
        let rows = tools.map { "\($0.label) \(cell($0.fivePct)) \(cell($0.weekPct))" }
        let text = rows.joined(separator: "\n")

        let para = NSMutableParagraphStyle()
        para.alignment = .right
        para.maximumLineHeight = 9.5
        para.minimumLineHeight = 9.5

        var color = NSColor.labelColor
        let worst = tools.flatMap { [$0.fivePct, $0.weekPct] }.compactMap { $0 }.max() ?? 0
        let anyStale = tools.allSatisfy { isStale($0.updatedAt) }
        if anyStale { color = NSColor.tertiaryLabelColor }
        else if ProcessInfo.processInfo.environment["AGENT_USAGE_BAR_ALERT_COLOR"] != nil, worst >= 80 {
            color = NSColor.systemRed
        }

        let topPad = Double(ProcessInfo.processInfo.environment["AGENT_USAGE_BAR_TOP_PAD"] ?? "") ?? 4.0
        return NSAttributedString(string: text, attributes: [
            .font: NSFont.monospacedSystemFont(ofSize: 9, weight: .medium),
            .paragraphStyle: para,
            .foregroundColor: color,
            .baselineOffset: -topPad,
        ])
    }

    func tools() -> [ToolUsage] {
        var t: [ToolUsage] = []
        if let c = readClaude() { t.append(c) } else {
            t.append(ToolUsage(label: "CC", name: "Claude Code", fivePct: nil, weekPct: nil,
                               fiveReset: nil, weekReset: nil, updatedAt: nil, note: "no snapshot yet"))
        }
        if let x = readCodex() { t.append(x) } else {
            t.append(ToolUsage(label: "CX", name: "Codex", fivePct: nil, weekPct: nil,
                               fiveReset: nil, weekReset: nil, updatedAt: nil, note: "run Codex once"))
        }
        return t
    }

    func render() {
        let t = tools()
        statusItem.button?.attributedTitle = titleAttr(t)
        rebuildMenu(t)
    }

    func rebuildMenu(_ tools: [ToolUsage]) {
        guard let menu = statusItem.menu else { return }
        menu.removeAllItems()
        for (idx, t) in tools.enumerated() {
            let head = NSMenuItem(title: t.name, action: nil, keyEquivalent: ""); head.isEnabled = false
            menu.addItem(head)
            if t.fivePct != nil || t.weekPct != nil {
                if t.fivePct != nil {
                    menu.addItem(withTitle: "  5-hour   \(pctText(t.fivePct))   resets \(resetText(t.fiveReset))",
                                 action: nil, keyEquivalent: "").isEnabled = false
                }
                menu.addItem(withTitle: "  weekly   \(pctText(t.weekPct))   resets \(resetText(t.weekReset))",
                             action: nil, keyEquivalent: "").isEnabled = false
                let upd = NSMenuItem(title: "  updated \(ageText(t.updatedAt))\(isStale(t.updatedAt) ? " · stale" : "")",
                                     action: nil, keyEquivalent: ""); upd.isEnabled = false
                menu.addItem(upd)
            }
            if let n = t.note {
                let ni = NSMenuItem(title: "  \(n)", action: nil, keyEquivalent: ""); ni.isEnabled = false
                menu.addItem(ni)
            }
            if idx < tools.count - 1 { menu.addItem(.separator()) }
        }
        menu.addItem(.separator())
        menu.addItem(withTitle: "Refresh", action: #selector(refreshNow), keyEquivalent: "r").target = self
        menu.addItem(withTitle: "Quit", action: #selector(quit), keyEquivalent: "q").target = self
    }

    func menuWillOpen(_ menu: NSMenu) { render() }
    @objc func refreshNow() { render() }
    @objc func quit() { NSApp.terminate(nil) }
}

// `--once`: print what the menu bar would show and exit (validation / scripting).
if CommandLine.arguments.contains("--once") {
    let d = AppDelegate()
    for t in d.tools() {
        print("\(t.label) \(cell(t.fivePct)) \(cell(t.weekPct))")
        FileHandle.standardError.write("  \(t.name): 5h \(pctText(t.fivePct)) · weekly \(pctText(t.weekPct))\(t.note.map { " · \($0)" } ?? "")\n".data(using: .utf8)!)
    }
    exit(0)
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
