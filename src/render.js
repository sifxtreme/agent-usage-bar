import { COLORS, THRESHOLDS } from './constants.js';
import {
  staleAfterMs,
  snapshotPath,
  menuFont,
  menuFontSize,
  menuStyle,
  barSegments,
} from './constants.js';
import { fmtPercent, fmtResetLocal, fmtAge } from './format.js';
import { buildStackImage, stackLabel } from './stack-image.js';

/**
 * Menu-bar text color. Default white (clean on a dark menu bar). Override with
 * AGENT_USAGE_BAR_COLOR ("auto" lets the menu bar pick). Opt into
 * red-when-critical with AGENT_USAGE_BAR_ALERT_COLOR.
 * @param {number} worst @param {boolean} stale @param {NodeJS.ProcessEnv} env
 * @returns {string | null} null omits the color attribute (adaptive)
 */
function menuBarColor(worst, stale, env) {
  const override = env.AGENT_USAGE_BAR_COLOR?.trim();
  if (override) return override.toLowerCase() === 'auto' ? null : override;
  if (env.AGENT_USAGE_BAR_ALERT_COLOR && !stale && worst >= THRESHOLDS.red) {
    return COLORS.red;
  }
  return 'white';
}

/**
 * SwiftBar line attributes shared by every retro menu-bar line.
 * @param {string | null} color @param {NodeJS.ProcessEnv} env
 */
function menuAttrs(color, env) {
  const parts = [`font=${menuFont(env)}`, `size=${menuFontSize(env)}`];
  if (color) parts.push(`color=${color}`);
  return parts.join(' ');
}

/**
 * Compact number for the menu bar: "15" or "--" when unavailable.
 * @param {number | null} pct
 */
function num(pct) {
  return pct === null ? '--' : String(pct);
}

/**
 * ASCII HP-meter gauge, e.g. "[##--]". ASCII-only so it stays inside any font.
 * @param {number | null} pct @param {number} segs
 */
function bar(pct, segs) {
  if (pct === null) return `[${'?'.repeat(segs)}]`;
  const filled = Math.round((pct / 100) * segs);
  return `[${'#'.repeat(filled)}${'-'.repeat(segs - filled)}]`;
}

/**
 * The menu-bar line (first block). Returns the `stack` image line when that
 * style is active and the image builds; otherwise a single text line.
 * @param {import('./snapshot.js').Snapshot} snap
 * @param {boolean} stale
 * @param {string | null} color
 * @param {NodeJS.ProcessEnv} env
 * @param {(l1: string, l2: string, env: NodeJS.ProcessEnv) => (string | null)} buildImage
 */
function menuBarLine(snap, stale, color, env, buildImage) {
  const staleMark = stale ? ' *' : '';

  if (menuStyle(env) === 'stack') {
    const img = buildImage(
      stackLabel('5h', snap.fiveHour),
      stackLabel('wk', snap.sevenDay),
      env,
    );
    // Empty title so only the two-row image shows in the menu bar.
    if (img) return `| templateImage=${img}`;
    // magick missing/failed — fall through to text so the bar never goes blank.
  }

  const segs = barSegments(env);
  const five = menuStyle(env) === 'bars' ? bar(snap.fiveHour, segs) : num(snap.fiveHour);
  const seven = menuStyle(env) === 'bars' ? bar(snap.sevenDay, segs) : num(snap.sevenDay);
  return `5H${five} WK${seven}${staleMark} | ${menuAttrs(color, env)}`;
}

/**
 * Render the SwiftBar/xbar output for a snapshot.
 * @param {import('./snapshot.js').Snapshot | null} snap
 * @param {{ now?: number, env?: NodeJS.ProcessEnv, buildImage?: (l1: string, l2: string, env: NodeJS.ProcessEnv) => (string | null) }} [opts]
 * @returns {string}
 */
export function renderSwiftBar(snap, opts = {}) {
  const env = opts.env ?? process.env;
  const now = opts.now ?? Date.now();
  const buildImage = opts.buildImage ?? buildStackImage;
  const lines = [];

  if (!snap) {
    lines.push(`5H-- WK-- | ${menuAttrs('white', env)}`);
    lines.push('---');
    lines.push('No usage snapshot yet | size=11 color=' + COLORS.dim);
    lines.push('Start a Claude Code session — its statusline writes the data. | size=11');
    lines.push('---');
    lines.push('Run doctor | bash=agent-usage-bar param1=doctor terminal=true');
    return lines.join('\n');
  }

  const age = now - snap.updatedAt;
  const stale = age > staleAfterMs(env);
  const worst = Math.max(snap.fiveHour ?? 0, snap.sevenDay ?? 0);
  const color = menuBarColor(worst, stale, env);

  lines.push(menuBarLine(snap, stale, color, env, buildImage));
  lines.push('---');
  lines.push(`CLAUDE CODE USAGE · updated ${fmtAge(age)} | size=11 color=${COLORS.dim}`);
  if (stale) {
    lines.push(`Stale — no session has rendered recently | size=11 color=${COLORS.amber}`);
  }
  lines.push(
    `5-hour session   ${fmtPercent(snap.fiveHour).padStart(4)}   resets ${fmtResetLocal(snap.fiveHourResetAt)} | font=Menlo`,
  );
  lines.push(
    `weekly (all)     ${fmtPercent(snap.sevenDay).padStart(4)}   resets ${fmtResetLocal(snap.sevenDayResetAt)} | font=Menlo`,
  );
  lines.push('---');
  lines.push('Refresh | refresh=true');
  lines.push(`Snapshot: ${snapshotPath(env)} | size=11 color=${COLORS.dim}`);
  return lines.join('\n');
}
