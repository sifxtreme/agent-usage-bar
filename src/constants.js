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

/**
 * Menu-bar font. Default is plain monospace (Menlo) at a normal size. Set
 * CLAUDE_USAGE_BAR_FONT=PressStart2P-Regular (+ a small FONT_SIZE like 10) for
 * the 16-bit pixel look. ASCII-only content keeps every glyph inside any font.
 */
export function menuFont(env = process.env) {
  return env.CLAUDE_USAGE_BAR_FONT?.trim() || 'Menlo';
}
export function menuFontSize(env = process.env) {
  const n = Number(env.CLAUDE_USAGE_BAR_FONT_SIZE);
  return Number.isFinite(n) && n > 0 ? n : 11;
}
/** 'numbers' (default, compact) or 'bars' (ASCII HP-meter gauges). */
export function menuStyle(env = process.env) {
  return (env.CLAUDE_USAGE_BAR_STYLE?.trim() || 'numbers').toLowerCase();
}
export function barSegments(env = process.env) {
  const n = Number(env.CLAUDE_USAGE_BAR_SEGMENTS);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 4;
}

/** Menu-bar colors (work on both light and dark menu bars). */
export const COLORS = {
  green: '#3fb950',
  amber: '#d29922',
  red: '#e5484d',
  dim: '#8b949e',
};
