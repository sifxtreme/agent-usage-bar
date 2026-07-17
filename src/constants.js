import * as os from 'node:os';
import * as path from 'node:path';

/** Snapshot schema version. Bump when the on-disk shape changes incompatibly. */
export const SNAPSHOT_SCHEMA = 1;

/**
 * Absolute path to the usage snapshot file.
 *
 * Override with CLAUDE_USAGE_BAR_SNAPSHOT. Defaults under the Claude config
 * dir (honoring CLAUDE_CONFIG_DIR) so it lives next to other Claude state.
 */
export function snapshotPath(env = process.env, homeDir = os.homedir()) {
  const override = env.CLAUDE_USAGE_BAR_SNAPSHOT?.trim();
  if (override) {
    return path.resolve(override);
  }
  const configDir = env.CLAUDE_CONFIG_DIR?.trim() || path.join(homeDir, '.claude');
  return path.join(configDir, 'usage-bar', 'usage.json');
}

/**
 * Age (ms) after which the snapshot is considered stale and the menu bar
 * annotates it. Usage only accrues while you use Claude, so a snapshot older
 * than this usually just means "no session running" — not an error.
 * Override with CLAUDE_USAGE_BAR_STALE_MINUTES.
 */
export function staleAfterMs(env = process.env) {
  const raw = Number(env.CLAUDE_USAGE_BAR_STALE_MINUTES);
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : 180; // 3h default
  return minutes * 60_000;
}

/** Percentage thresholds for menu-bar coloring. */
export const THRESHOLDS = { amber: 50, red: 80 };

/** Menu-bar colors (work on both light and dark menu bars). */
export const COLORS = {
  green: '#3fb950',
  amber: '#d29922',
  red: '#e5484d',
  dim: '#8b949e',
};
