import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSwiftBar } from '../src/render.js';
import { COLORS } from '../src/constants.js';

const NOW = 1_768_600_000_000;

/** @param {string} out @returns {string} the menu-bar line */
const firstLine = (out) => out.split('\n')[0] ?? '';

/** @param {Partial<import('../src/snapshot.js').Snapshot>} [over] */
function snap(over = {}) {
  return {
    schema: 1,
    updatedAt: NOW,
    fiveHour: 9,
    sevenDay: 22,
    fiveHourResetAt: NOW + 3_600_000,
    sevenDayResetAt: NOW + 86_400_000,
    ...over,
  };
}

test('renders a menu-bar line and a dropdown', () => {
  const out = renderSwiftBar(snap(), { now: NOW });
  const bar = firstLine(out);
  assert.match(bar, /^5h 9% · wk 22%/);
  assert.match(bar, new RegExp(COLORS.green)); // worst=22 -> green
  assert.ok(out.split('\n').includes('---'));
  assert.match(out, /5-hour session/);
  assert.match(out, /weekly \(all\)/);
  assert.match(out, /Refresh \| refresh=true/);
});

test('color escalates with the worse window', () => {
  assert.match(firstLine(renderSwiftBar(snap({ sevenDay: 85 }), { now: NOW })), new RegExp(COLORS.red));
  assert.match(firstLine(renderSwiftBar(snap({ sevenDay: 60 }), { now: NOW })), new RegExp(COLORS.amber));
});

test('missing window shows an em dash', () => {
  const out = renderSwiftBar(snap({ fiveHour: null }), { now: NOW });
  assert.match(firstLine(out), /^5h — · wk 22%/);
});

test('stale snapshot is dimmed and annotated', () => {
  const out = renderSwiftBar(snap(), { now: NOW + 5 * 60 * 60 * 1000 }); // 5h later > 3h default
  const bar = firstLine(out);
  assert.match(bar, new RegExp(COLORS.dim));
  assert.match(bar, /◦/);
  assert.match(out, /Stale/);
});

test('null snapshot renders a helpful empty state', () => {
  const out = renderSwiftBar(null, { now: NOW });
  assert.match(firstLine(out), /^CC usage —/);
  assert.match(out, /No usage snapshot yet/);
});
