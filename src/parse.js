import { clampPercent, normalizeResetAt } from './format.js';

/**
 * @typedef {Object} Usage
 * @property {number | null} fiveHour        used %, 0-100
 * @property {number | null} sevenDay        used %, 0-100
 * @property {number | null} fiveHourResetAt epoch ms
 * @property {number | null} sevenDayResetAt epoch ms
 */

/**
 * Extract usage from the Claude Code statusline stdin payload.
 *
 * The harness delivers `rate_limits.{five_hour,seven_day}` with
 * `used_percentage` (0-100) and `resets_at` (epoch seconds). This is the
 * OFFICIAL, documented source — no credentials or network calls involved.
 * See https://code.claude.com/docs/en/statusline
 *
 * @param {unknown} payload parsed statusline JSON object
 * @returns {Usage | null} null when the payload carries no usable rate limits
 */
export function parseStatuslinePayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const rate = /** @type {Record<string, any>} */ (payload).rate_limits;
  if (!rate || typeof rate !== 'object') return null;

  const fiveHour = clampPercent(rate.five_hour?.used_percentage);
  const sevenDay = clampPercent(rate.seven_day?.used_percentage);

  // No usable percentage on either window — nothing worth recording.
  if (fiveHour === null && sevenDay === null) return null;

  return {
    fiveHour,
    sevenDay,
    fiveHourResetAt: normalizeResetAt(rate.five_hour?.resets_at),
    sevenDayResetAt: normalizeResetAt(rate.seven_day?.resets_at),
  };
}
