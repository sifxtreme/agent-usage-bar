// claude-usage-menubar — a tiny native macOS menu-bar app that shows Claude
// Code's 5-hour and weekly usage limits as two stacked, crisp lines.
//
// Reads the same snapshot the statusline hook writes (no network, no
// credentials). Refreshes on a timer and whenever you open the menu.
//
// Build:  swiftc -O native/ClaudeUsageMenuBar.swift -o bin/claude-usage-menubar
// Run:    ./bin/claude-usage-menubar   (or via the LaunchAgent, see README)

import Cocoa

// MARK: - Snapshot model

struct Usage {
    var fiveHour: Int?
    var sevenDay: Int?
    var fiveHourResetAt: Date?
    var sevenDayResetAt: Date?
    var updatedAt: Date?
}

func snapshotURL() -> URL {
    let env = ProcessInfo.processInfo.environment
    if let override = env["CLAUDE_USAGE_BAR_SNAPSHOT"], !override.isEmpty {
        return URL(fileURLWithPath: (override as NSString).expandingTildeInPath)
    }
    let home = FileManager.default.homeDirectoryForCurrentUser
    let base = env["CLAUDE_CONFIG_DIR"].flatMap { $0.isEmpty ? nil : URL(fileURLWithPath: $0) }
        ?? home.appendingPathComponent(".claude")
    return base.appendingPathComponent("usage-bar/usage.json")
}

func readUsage() -> Usage? {
    guard let data = try? Data(contentsOf: snapshotURL()),
          let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        return nil
    }
    func ms(_ key: String) -> Date? {
        if let n = obj[key] as? Double, n > 0 { return Date(timeIntervalSince1970: n / 1000.0) }
        return nil
    }
    func pct(_ key: String) -> Int? {
        if let n = obj[key] as? Double { return Int(n.rounded()) }
        if let n = obj[key] as? Int { return n }
        return nil
    }
    var u = Usage()
    u.fiveHour = pct("fiveHour")
    u.sevenDay = pct("sevenDay")
    u.fiveHourResetAt = ms("fiveHourResetAt")
    u.sevenDayResetAt = ms("sevenDayResetAt")
    u.updatedAt = ms("updatedAt")
    // Treat a snapshot with neither percentage as absent.
    return (u.fiveHour == nil && u.sevenDay == nil) ? nil : u
}

// MARK: - Formatting

// Zero-padded to 2 digits so the rows line up: 0 -> "00%", 9 -> "09%", 100 -> "100%".
func pctText(_ v: Int?) -> String { v.map { String(format: "%02d%%", $0) } ?? "--%" }

func resetText(_ d: Date?) -> String {
    guard let d = d else { return "?" }
    let f = DateFormatter()
    f.dateFormat = "EEE h:mm a"
    return f.string(from: d)
}

func ageText(_ d: Date?) -> String {
    guard let d = d else { return "unknown" }
    let mins = Int(Date().timeIntervalSince(d) / 60)
    if mins < 1 { return "just now" }
    if mins < 60 { return "\(mins)m ago" }
    let h = mins / 60
    return h < 24 ? "\(h)h ago" : "\(h / 24)d ago"
}

let staleMinutes: Int = {
    if let s = ProcessInfo.processInfo.environment["CLAUDE_USAGE_BAR_STALE_MINUTES"],
       let n = Int(s), n > 0 { return n }
    return 180
}()

// MARK: - App

class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    var timer: Timer?

    func applicationDidFinishLaunching(_ note: Notification) {
        let menu = NSMenu()
        menu.delegate = self
        statusItem.menu = menu

        // NSStatusBarButton is single-line by default — allow the two-row title.
        if let button = statusItem.button {
            button.lineBreakMode = .byClipping
            if let cell = button.cell as? NSButtonCell {
                cell.wraps = true
                cell.usesSingleLineMode = false
                cell.lineBreakMode = .byClipping
            }
        }

        render()
        // Local-file read only — cheap. 60s keeps the "stale" state honest.
        timer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            self?.render()
        }
    }

    // Two stacked lines as a real attributed title — the native "stack".
    func titleAttr(_ u: Usage?, stale: Bool) -> NSAttributedString {
        let five = u?.fiveHour
        let seven = u?.sevenDay
        // Right-aligned paragraph keeps the two percentages flush on the right edge.
        let text = "5h \(pctText(five))\nwk \(pctText(seven))"

        let para = NSMutableParagraphStyle()
        para.alignment = .right
        para.maximumLineHeight = 9.5
        para.minimumLineHeight = 9.5

        let worst = max(five ?? 0, seven ?? 0)
        var color = NSColor.labelColor           // adapts: white on dark, black on light
        if stale { color = NSColor.tertiaryLabelColor }
        else if ProcessInfo.processInfo.environment["CLAUDE_USAGE_BAR_ALERT_COLOR"] != nil,
                worst >= 80 { color = NSColor.systemRed }

        // Negative baseline offset lowers the text — adds top padding so the
        // two rows aren't jammed against the top edge of the menu bar.
        let topPad = Double(ProcessInfo.processInfo.environment["CLAUDE_USAGE_BAR_TOP_PAD"] ?? "") ?? 4.0

        return NSAttributedString(string: text, attributes: [
            // Full monospace (SF Mono) so labels AND digits are fixed-width and the
            // two rows align exactly. monospacedDigit only fixes the digits.
            .font: NSFont.monospacedSystemFont(ofSize: 9, weight: .medium),
            .paragraphStyle: para,
            .foregroundColor: color,
            .baselineOffset: -topPad,
        ])
    }

    func render() {
        let u = readUsage()
        let stale = u?.updatedAt.map { Date().timeIntervalSince($0) > Double(staleMinutes * 60) } ?? true
        statusItem.button?.attributedTitle = titleAttr(u, stale: stale)
        rebuildMenu(u, stale: stale)
    }

    func rebuildMenu(_ u: Usage?, stale: Bool) {
        guard let menu = statusItem.menu else { return }
        menu.removeAllItems()
        let header = NSMenuItem(title: "Claude Code usage", action: nil, keyEquivalent: "")
        header.isEnabled = false
        menu.addItem(header)

        if let u = u {
            menu.addItem(withTitle: "5-hour   \(pctText(u.fiveHour))   resets \(resetText(u.fiveHourResetAt))",
                         action: nil, keyEquivalent: "").isEnabled = false
            menu.addItem(withTitle: "weekly   \(pctText(u.sevenDay))   resets \(resetText(u.sevenDayResetAt))",
                         action: nil, keyEquivalent: "").isEnabled = false
            let updated = NSMenuItem(title: "updated \(ageText(u.updatedAt))\(stale ? " · stale" : "")",
                                     action: nil, keyEquivalent: "")
            updated.isEnabled = false
            menu.addItem(updated)
        } else {
            let empty = NSMenuItem(title: "No snapshot yet — start a Claude Code session", action: nil, keyEquivalent: "")
            empty.isEnabled = false
            menu.addItem(empty)
        }

        menu.addItem(.separator())
        menu.addItem(withTitle: "Refresh", action: #selector(refreshNow), keyEquivalent: "r").target = self
        menu.addItem(withTitle: "Quit", action: #selector(quit), keyEquivalent: "q").target = self
    }

    // Refresh the moment the menu is clicked open.
    func menuWillOpen(_ menu: NSMenu) { render() }

    @objc func refreshNow() { render() }
    @objc func quit() { NSApp.terminate(nil) }
}

// `--once`: print what the menu bar would show and exit (no status item).
// Useful for `doctor`, scripting, and validating the reader without a GUI.
if CommandLine.arguments.contains("--once") {
    let u = readUsage()
    print("5h \(pctText(u?.fiveHour))")
    print("wk \(pctText(u?.sevenDay))")
    if let u = u {
        let stale = u.updatedAt.map { Date().timeIntervalSince($0) > Double(staleMinutes * 60) } ?? true
        let note = "  5h resets \(resetText(u.fiveHourResetAt)) · wk resets \(resetText(u.sevenDayResetAt))"
            + " · updated \(ageText(u.updatedAt))\(stale ? " · STALE" : "")\n"
        FileHandle.standardError.write(note.data(using: .utf8)!)
    } else {
        FileHandle.standardError.write("  (no snapshot at \(snapshotURL().path))\n".data(using: .utf8)!)
    }
    exit(0)
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory) // menu-bar only, no Dock icon
let delegate = AppDelegate()
app.delegate = delegate
app.run()
