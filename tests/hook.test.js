import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { runHook, compactLine } from '../src/hook.js';
import { readSnapshot } from '../src/snapshot.js';

/** @param {string} label */
function tmpEnv(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `cub-${label}-`));
  return { CLAUDE_USAGE_BAR_SNAPSHOT: path.join(dir, 'usage.json') };
}

/**
 * A fake stdin stream carrying `text`.
 * @param {string} text
 * @returns {import('node:stream').Readable & { isTTY?: boolean }}
 */
function fakeStdin(text) {
  const s = /** @type {import('node:stream').Readable & { isTTY?: boolean }} */ (Readable.from([text]));
  s.isTTY = false;
  return s;
}

test('hook writes a snapshot from the statusline payload and prints a line', async () => {
  const env = tmpEnv('hook');
  const payload = JSON.stringify({
    rate_limits: {
      five_hour: { used_percentage: 8.6, resets_at: 1768672799 },
      seven_day: { used_percentage: 22, resets_at: 1769097599 },
    },
  });
  let printed = '';
  await runHook({
    argv: [],
    stdin: fakeStdin(payload),
    env,
    now: 5000,
    log: (s) => (printed += s),
  });

  const snap = readSnapshot(env);
  assert.equal(snap?.fiveHour, 9);
  assert.equal(snap?.sevenDay, 22);
  assert.equal(snap?.updatedAt, 5000);
  assert.match(printed, /5h 9% · wk 22%/);
});

test('--quiet writes the snapshot but prints nothing', async () => {
  const env = tmpEnv('quiet');
  const payload = JSON.stringify({ rate_limits: { five_hour: { used_percentage: 3 } } });
  let printed = '';
  await runHook({ argv: ['--quiet'], stdin: fakeStdin(payload), env, log: (s) => (printed += s) });
  assert.equal(printed, '');
  assert.equal(readSnapshot(env)?.fiveHour, 3);
});

test('a payload without rate_limits does not create or clobber a snapshot', async () => {
  const env = tmpEnv('empty');
  await runHook({ argv: ['--quiet'], stdin: fakeStdin('{"model":{"display_name":"x"}}'), env });
  assert.equal(readSnapshot(env), null);
});

test('malformed stdin is swallowed, no throw', async () => {
  const env = tmpEnv('bad');
  await runHook({ argv: ['--quiet'], stdin: fakeStdin('{not json'), env });
  assert.equal(readSnapshot(env), null);
});

test('compactLine formats both windows', () => {
  assert.equal(
    compactLine({ fiveHour: 9, sevenDay: 22, fiveHourResetAt: null, sevenDayResetAt: null }),
    '⧗ 5h 9% · wk 22%',
  );
});
