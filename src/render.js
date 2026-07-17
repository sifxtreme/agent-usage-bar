import { COLORS } from './constants.js';
import { staleAfterMs, snapshotPath } from './constants.js';
import { colorForPercent, fmtPercent, fmtResetLocal, fmtAge } from './format.js';

/**
 * Render the SwiftBar/xbar output for a snapshot.
 *
 * SwiftBar format: the first block (before the first `---`) is the menu-bar
 * text; lines after `---` populate the dropdown. See https://github.com/swiftbar/SwiftBar
 *
 * @param {import('./snapshot.js').Snapshot | null} snap
 * @param {{ now?: number, env?: NodeJS.ProcessEnv }} [opts]
 * @returns {string}
 */
export function renderSwiftBar(snap, opts = {}) {
  const env = opts.env ?? process.env;
  const now = opts.now ?? Date.now();
  const lines = [];

  if (!snap) {
    lines.push(`CC usage — | color=${COLORS.dim} font=Menlo size=13`);
    lines.push('---');
    lines.push('No usage snapshot yet | size=11 color=' + COLORS.dim);
    lines.push('Start a Claude Code session — its statusline writes the data. | size=11');
    lines.push('---');
    lines.push('Run doctor | bash=claude-usage-bar param1=doctor terminal=true');
    return lines.join('\n');
  }

  const age = now - snap.updatedAt;
  const stale = age > staleAfterMs(env);
  const worst = Math.max(snap.fiveHour ?? 0, snap.sevenDay ?? 0);
  const barColor = stale ? COLORS.dim : colorForPercent(worst);

  const staleMark = stale ? ' ◦' : '';
  lines.push(
    `5h ${fmtPercent(snap.fiveHour)} · wk ${fmtPercent(snap.sevenDay)}${staleMark} | color=${barColor} font=Menlo size=13`,
  );
  lines.push('---');
  lines.push(`Claude Code usage · updated ${fmtAge(age)} | size=11 color=${COLORS.dim}`);
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
