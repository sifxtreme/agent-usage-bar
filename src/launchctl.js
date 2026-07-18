import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/** LaunchAgent label for the native menu-bar app (matches native/install.sh). */
export const LAUNCH_LABEL = 'com.agent-usage-bar.menubar';

/** Absolute path to the installed LaunchAgent plist. */
export function plistPath(homeDir = os.homedir()) {
  return path.join(homeDir, 'Library', 'LaunchAgents', `${LAUNCH_LABEL}.plist`);
}

/** `gui/<uid>` domain target for per-user LaunchAgents. */
function guiDomain() {
  const uid = typeof process.getuid === 'function' ? process.getuid() : 0;
  return `gui/${uid}`;
}

/** `gui/<uid>/<label>` service target. */
function serviceTarget() {
  return `${guiDomain()}/${LAUNCH_LABEL}`;
}

/**
 * Run launchctl, returning its exit code and stdout. Never throws — for this
 * tool a non-zero exit is data (e.g. "service not loaded"), not a failure.
 * @param {string[]} args
 * @returns {{ code: number, out: string }}
 */
function launchctl(args) {
  try {
    const out = execFileSync('launchctl', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return { code: 0, out };
  } catch (err) {
    const e = /** @type {{ status?: number, stdout?: string }} */ (err);
    return { code: typeof e.status === 'number' ? e.status : 1, out: e.stdout ?? '' };
  }
}

/**
 * Extract the live PID from `launchctl list <label>` output, or null when the
 * service is loaded but not running (no `"PID"` line). Kept pure so the parse
 * — which depends on launchctl's exact `"PID" = 123;` format — is unit-tested.
 * @param {string} out
 * @returns {number | null}
 */
export function parseListPid(out) {
  const m = out.match(/"PID"\s*=\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * Inspect the native menu-bar app's LaunchAgent.
 *
 * `installed` = the plist exists. `loaded` = launchd knows the service.
 * `running` = it currently has a PID. After a clean Quit the agent is
 * loaded-but-not-running (KeepAlive only relaunches on a crash), which is
 * exactly the state that looks "installed and fine" but shows no menu bar.
 * @param {string} [homeDir]
 * @returns {{ installed: boolean, loaded: boolean, running: boolean, pid: number | null }}
 */
export function launchAgentStatus(homeDir = os.homedir()) {
  const installed = fs.existsSync(plistPath(homeDir));
  const { code, out } = launchctl(['list', LAUNCH_LABEL]);
  const loaded = code === 0;
  const pid = parseListPid(out);
  return { installed, loaded, running: pid !== null, pid };
}

/**
 * Ensure the LaunchAgent is loaded and its process is (re)started. Recovers
 * the common "I quit it and it didn't come back" case in one call.
 * @param {string} [homeDir]
 * @returns {{ ok: boolean, message: string }}
 */
export function restartAgent(homeDir = os.homedir()) {
  const plist = plistPath(homeDir);
  if (!fs.existsSync(plist)) {
    return { ok: false, message: 'LaunchAgent not installed — run ./native/install.sh first.' };
  }
  // Reload it if a prior `stop` (bootout) unloaded it; harmless if already loaded.
  if (!launchAgentStatus(homeDir).loaded) {
    launchctl(['bootstrap', guiDomain(), plist]);
  }
  // Force a fresh start even if it is already running.
  launchctl(['kickstart', '-k', serviceTarget()]);
  const st = launchAgentStatus(homeDir);
  return st.running
    ? { ok: true, message: `menu-bar app running (pid ${st.pid}).` }
    : { ok: false, message: 'could not start the menu-bar app — try ./native/install.sh.' };
}

/**
 * Stop the menu-bar app until the next login (the scriptable form of the
 * menu's Quit). Unloads the agent so KeepAlive won't relaunch it.
 * @param {string} [homeDir]
 * @returns {{ ok: boolean, message: string }}
 */
export function stopAgent(homeDir = os.homedir()) {
  if (!fs.existsSync(plistPath(homeDir))) {
    return { ok: false, message: 'LaunchAgent not installed; nothing to stop.' };
  }
  launchctl(['bootout', serviceTarget()]);
  const st = launchAgentStatus(homeDir);
  return st.running
    ? { ok: false, message: `still running (pid ${st.pid}); try again.` }
    : { ok: true, message: 'stopped. Returns at next login, or run `agent-usage-bar restart`.' };
}
