import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { writeSnapshot, readSnapshot, validateSnapshot } from '../src/snapshot.js';
import { SNAPSHOT_SCHEMA } from '../src/constants.js';

/**
 * Fresh isolated env pointing the snapshot at a unique temp file.
 * @param {string} label
 */
function tmpEnv(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `cub-${label}-`));
  return { CLAUDE_USAGE_BAR_SNAPSHOT: path.join(dir, 'usage.json') };
}

test('write then read round-trips', () => {
  const env = tmpEnv('rt');
  writeSnapshot(
    { fiveHour: 9, sevenDay: 22, fiveHourResetAt: 111, sevenDayResetAt: 222 },
    { now: 1000, env },
  );
  const snap = readSnapshot(env);
  assert.equal(snap?.schema, SNAPSHOT_SCHEMA);
  assert.equal(snap?.updatedAt, 1000);
  assert.equal(snap?.fiveHour, 9);
  assert.equal(snap?.sevenDay, 22);
  assert.equal(snap?.fiveHourResetAt, 111);
});

test('the snapshot file is written 0600', () => {
  const env = tmpEnv('perm');
  writeSnapshot({ fiveHour: 1, sevenDay: 2, fiveHourResetAt: null, sevenDayResetAt: null }, { env });
  const mode = fs.statSync(env.CLAUDE_USAGE_BAR_SNAPSHOT).mode & 0o777;
  assert.equal(mode, 0o600);
});

test('null fields fall back to previous snapshot (never overwrite good data)', () => {
  const env = tmpEnv('merge');
  writeSnapshot({ fiveHour: 9, sevenDay: 22, fiveHourResetAt: 111, sevenDayResetAt: 222 }, { now: 1, env });
  // Next render only carries a fresh 5h value; weekly should be preserved.
  writeSnapshot({ fiveHour: 12, sevenDay: null, fiveHourResetAt: 333, sevenDayResetAt: null }, { now: 2, env });
  const snap = readSnapshot(env);
  assert.equal(snap?.fiveHour, 12);
  assert.equal(snap?.sevenDay, 22); // preserved
  assert.equal(snap?.sevenDayResetAt, 222); // preserved
  assert.equal(snap?.updatedAt, 2);
});

test('readSnapshot returns null for a missing file', () => {
  assert.equal(readSnapshot(tmpEnv('missing')), null);
});

test('validateSnapshot rejects malformed / wrong-schema / empty', () => {
  assert.equal(validateSnapshot(null), null);
  assert.equal(validateSnapshot({ schema: 999, updatedAt: 1, fiveHour: 5 }), null);
  assert.equal(validateSnapshot({ schema: SNAPSHOT_SCHEMA, fiveHour: 5 }), null); // no updatedAt
  assert.equal(
    validateSnapshot({ schema: SNAPSHOT_SCHEMA, updatedAt: 1, fiveHour: null, sevenDay: null }),
    null,
  );
});

test('a corrupt snapshot file reads back as null, not a throw', () => {
  const env = tmpEnv('corrupt');
  fs.mkdirSync(path.dirname(env.CLAUDE_USAGE_BAR_SNAPSHOT), { recursive: true });
  fs.writeFileSync(env.CLAUDE_USAGE_BAR_SNAPSHOT, '{ this is not json');
  assert.equal(readSnapshot(env), null);
});
