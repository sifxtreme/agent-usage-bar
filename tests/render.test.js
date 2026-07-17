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

test('menu bar is compact, white, pixel-font by default', () => {
  const out = renderSwiftBar(snap(), { now: NOW, env: {} });
  const bar = firstLine(out);
  assert.match(bar, /^5H9 WK22 \|/);
  assert.match(bar, /color=white/);
  assert.match(bar, /font=PressStart2P-Regular/);
  assert.match(bar, /size=10/);
});

test('dropdown keeps readable numbers + reset times', () => {
  const out = renderSwiftBar(snap(), { now: NOW, env: {} });
  assert.ok(out.split('\n').includes('---'));
  assert.match(out, /5-hour session/);
  assert.match(out, /weekly \(all\)/);
  assert.match(out, /Refresh \| refresh=true/);
});

test('color stays white regardless of level by default', () => {
  assert.match(firstLine(renderSwiftBar(snap({ sevenDay: 95 }), { now: NOW, env: {} })), /color=white/);
});

test('opt-in alert color turns red only when critical', () => {
  const env = { CLAUDE_USAGE_BAR_ALERT_COLOR: '1' };
  assert.match(firstLine(renderSwiftBar(snap({ sevenDay: 85 }), { now: NOW, env })), new RegExp(COLORS.red));
  assert.match(firstLine(renderSwiftBar(snap({ sevenDay: 40 }), { now: NOW, env })), /color=white/);
});

test('bars style renders ASCII HP meters', () => {
  const env = { CLAUDE_USAGE_BAR_STYLE: 'bars', CLAUDE_USAGE_BAR_SEGMENTS: '4' };
  const bar = firstLine(renderSwiftBar(snap({ fiveHour: 50, sevenDay: 25 }), { now: NOW, env }));
  assert.match(bar, /^5H\[##--\] WK\[#---\]/);
});

test('custom font + size honored', () => {
  const env = { CLAUDE_USAGE_BAR_FONT: 'Silkscreen', CLAUDE_USAGE_BAR_FONT_SIZE: '12' };
  const bar = firstLine(renderSwiftBar(snap(), { now: NOW, env }));
  assert.match(bar, /font=Silkscreen/);
  assert.match(bar, /size=12/);
});

test('missing window shows --', () => {
  const out = renderSwiftBar(snap({ fiveHour: null }), { now: NOW, env: {} });
  assert.match(firstLine(out), /^5H-- WK22 /);
});

test('stale snapshot is marked with * and annotated', () => {
  const out = renderSwiftBar(snap(), { now: NOW + 5 * 60 * 60 * 1000, env: {} });
  assert.match(firstLine(out), /\*/);
  assert.match(out, /Stale/);
});

test('null snapshot renders a helpful empty state', () => {
  const out = renderSwiftBar(null, { now: NOW, env: {} });
  assert.match(firstLine(out), /^5H-- WK--/);
  assert.match(out, /No usage snapshot yet/);
});
