import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { snapshotPath, staleAfterMs } from './constants.js';
import { readSnapshot } from './snapshot.js';
import { fmtAge } from './format.js';

const OK = '✓';
const WARN = '!';
const BAD = '✗';

/**
 * Print a setup/health report so users can see what's wired and what isn't.
 * @param {{ env?: NodeJS.ProcessEnv, now?: number, log?: (s: string) => void }} [deps]
 * @returns {number} process exit code (0 healthy, 1 something needs attention)
 */
export function runDoctor(deps = {}) {
  const env = deps.env ?? process.env;
  const now = deps.now ?? Date.now();
  const log = deps.log ?? ((s) => console.log(s));
  let problems = 0;

  log('claude-usage-bar doctor\n');

  // 1) statusLine hook configured?
  const configDir = env.CLAUDE_CONFIG_DIR?.trim() || path.join(os.homedir(), '.claude');
  let hookConfigured = false;
  for (const name of ['settings.json', 'settings.local.json']) {
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(configDir, name), 'utf8'));
      const cmd = cfg?.statusLine?.command;
      if (typeof cmd === 'string' && cmd.includes('claude-usage-bar')) hookConfigured = true;
    } catch {
      /* file may not exist */
    }
  }
  if (hookConfigured) {
    log(`${OK} statusLine hook is configured in ${configDir}`);
  } else {
    problems++;
    log(`${BAD} statusLine hook NOT found in ${configDir}/settings.json`);
    log('    Add:  "statusLine": { "type": "command", "command": "claude-usage-bar hook" }');
  }

  // 2) snapshot present + fresh?
  const snap = readSnapshot(env);
  if (!snap) {
    problems++;
    log(`${BAD} no snapshot at ${snapshotPath(env)}`);
    log('    Start (or continue) a Claude Code session so its statusline writes one.');
  } else {
    const age = now - snap.updatedAt;
    const stale = age > staleAfterMs(env);
    log(`${stale ? WARN : OK} snapshot ${stale ? 'is stale' : 'is fresh'} (updated ${fmtAge(age)})`);
    log(`    5h=${snap.fiveHour ?? '—'}%  wk=${snap.sevenDay ?? '—'}%`);
  }

  // 3) A reader is installed — the native menu-bar app OR SwiftBar/xbar.
  const nativeAgent = path.join(os.homedir(), 'Library/LaunchAgents/com.claude-usage-bar.menubar.plist');
  if (fs.existsSync(nativeAgent)) {
    log(`${OK} native menu-bar app installed (LaunchAgent present)`);
  } else if (fs.existsSync('/Applications/SwiftBar.app')) {
    log(`${OK} SwiftBar is installed`);
  } else if (fs.existsSync('/Applications/xbar.app')) {
    log(`${OK} xbar is installed`);
  } else {
    problems++;
    log(`${WARN} no reader installed`);
    log('    native app:  ./native/install.sh');
    log('    or SwiftBar:  brew install --cask swiftbar');
  }

  log(problems === 0 ? '\nAll good.' : `\n${problems} item(s) need attention.`);
  return problems === 0 ? 0 : 1;
}
