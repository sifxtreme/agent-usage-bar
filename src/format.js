import { THRESHOLDS, COLORS } from './constants.js';

/**
 * Clamp/round a raw percentage to an integer in [0, 100].
 * @param {unknown} value
 * @returns {number | null} null when not a finite number
 */
export function clampPercent(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(Math.min(100, Math.max(0, value)));
}

/**
 * Normalize a reset timestamp to epoch milliseconds.
 *
 * The Claude Code statusline payload sends epoch SECONDS. We also accept
 * epoch ms and ISO strings so the tool survives a schema change.
 * @param {unknown} value
 * @returns {number | null}
 */
export function normalizeResetAt(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    // < 1e12 => seconds (year ~33658 in ms), else already ms.
    return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Pick a menu-bar color for a percentage (green < 50 <= amber < 80 <= red).
 * @param {number | null} pct
 * @returns {string}
 */
export function colorForPercent(pct) {
  if (pct === null) return COLORS.dim;
  if (pct >= THRESHOLDS.red) return COLORS.red;
  if (pct >= THRESHOLDS.amber) return COLORS.amber;
  return COLORS.green;
}

/**
 * Human "time ago" for the snapshot age.
 * @param {number} ms
 * @returns {string}
 */
export function fmtAge(ms) {
  if (!Number.isFinite(ms) || ms < 0) return 'unknown';
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Format a reset timestamp in the machine's local timezone, e.g. "Fri 10:59 AM".
 * @param {number | null} msEpoch
 * @returns {string}
 */
export function fmtResetLocal(msEpoch) {
  if (msEpoch === null || !Number.isFinite(msEpoch)) return '?';
  try {
    return new Date(msEpoch).toLocaleString(undefined, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '?';
  }
}

/**
 * Render a percentage for display: "9%" or "—" when unavailable.
 * @param {number | null} pct
 * @returns {string}
 */
export function fmtPercent(pct) {
  return pct === null ? '—' : `${pct}%`;
}
