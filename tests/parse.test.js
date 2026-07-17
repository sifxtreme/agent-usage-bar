import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStatuslinePayload } from '../src/parse.js';
import { normalizeResetAt, clampPercent, colorForPercent } from '../src/format.js';
import { COLORS } from '../src/constants.js';

test('parses the official statusline rate_limits shape', () => {
  const usage = parseStatuslinePayload({
    rate_limits: {
      five_hour: { used_percentage: 8.6, resets_at: 1768672799 },
      seven_day: { used_percentage: 22, resets_at: 1769097599 },
    },
  });
  assert.equal(usage?.fiveHour, 9); // rounded
  assert.equal(usage?.sevenDay, 22);
  assert.equal(usage?.fiveHourResetAt, 1768672799 * 1000); // seconds -> ms
  assert.equal(usage?.sevenDayResetAt, 1769097599 * 1000);
});

test('returns null when there are no rate_limits', () => {
  assert.equal(parseStatuslinePayload({ model: { display_name: 'x' } }), null);
  assert.equal(parseStatuslinePayload(null), null);
  assert.equal(parseStatuslinePayload('nope'), null);
});

test('returns null when both percentages are missing', () => {
  assert.equal(
    parseStatuslinePayload({ rate_limits: { five_hour: {}, seven_day: {} } }),
    null,
  );
});

test('keeps one window when the other is absent', () => {
  const usage = parseStatuslinePayload({
    rate_limits: { seven_day: { used_percentage: 40 } },
  });
  assert.equal(usage?.fiveHour, null);
  assert.equal(usage?.sevenDay, 40);
  assert.equal(usage?.sevenDayResetAt, null);
});

test('clampPercent clamps, rounds, and rejects non-numbers', () => {
  assert.equal(clampPercent(150), 100);
  assert.equal(clampPercent(-5), 0);
  assert.equal(clampPercent(8.6), 9);
  assert.equal(clampPercent('9'), null);
  assert.equal(clampPercent(NaN), null);
});

test('normalizeResetAt handles seconds, ms, ISO, and junk', () => {
  assert.equal(normalizeResetAt(1768672799), 1768672799000); // seconds
  assert.equal(normalizeResetAt(1768672799000), 1768672799000); // ms passthrough
  assert.equal(normalizeResetAt('2026-01-17T17:59:59Z'), Date.parse('2026-01-17T17:59:59Z'));
  assert.equal(normalizeResetAt(0), null);
  assert.equal(normalizeResetAt('nope'), null);
});

test('colorForPercent thresholds', () => {
  assert.equal(colorForPercent(10), COLORS.green);
  assert.equal(colorForPercent(50), COLORS.amber);
  assert.equal(colorForPercent(79), COLORS.amber);
  assert.equal(colorForPercent(80), COLORS.red);
  assert.equal(colorForPercent(null), COLORS.dim);
});
