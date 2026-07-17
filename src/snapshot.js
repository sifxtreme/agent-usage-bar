import * as fs from 'node:fs';
import * as path from 'node:path';
import { SNAPSHOT_SCHEMA, snapshotPath } from './constants.js';
import { clampPercent } from './format.js';

/**
 * @typedef {Object} Snapshot
 * @property {number} schema
 * @property {number} updatedAt              epoch ms this file was written
 * @property {number | null} fiveHour        used %, 0-100
 * @property {number | null} sevenDay        used %, 0-100
 * @property {number | null} fiveHourResetAt epoch ms
 * @property {number | null} sevenDayResetAt epoch ms
 */

/**
 * Validate a value parsed off disk into a Snapshot, or null if malformed.
 * Guards against a truncated/corrupt file being trusted as real data.
 * @param {unknown} raw
 * @returns {Snapshot | null}
 */
export function validateSnapshot(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  if (o.schema !== SNAPSHOT_SCHEMA) return null;
  if (typeof o.updatedAt !== 'number' || !Number.isFinite(o.updatedAt)) return null;

  const five = clampPercent(o.fiveHour);
  const seven = clampPercent(o.sevenDay);
  // A snapshot with neither percentage is not useful data.
  if (five === null && seven === null) return null;

  const num = (/** @type {unknown} */ v) =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;

  return {
    schema: SNAPSHOT_SCHEMA,
    updatedAt: o.updatedAt,
    fiveHour: five,
    sevenDay: seven,
    fiveHourResetAt: num(o.fiveHourResetAt),
    sevenDayResetAt: num(o.sevenDayResetAt),
  };
}

/**
 * Read and validate the snapshot. Returns null if missing or malformed.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Snapshot | null}
 */
export function readSnapshot(env = process.env) {
  try {
    const raw = fs.readFileSync(snapshotPath(env), 'utf8');
    return validateSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Atomically write the snapshot (temp file + rename) with 0600 perms.
 *
 * Hardening: individual null fields fall back to the previous snapshot so we
 * never overwrite good data with a gap (a window may momentarily report null).
 * Callers must not pass a usage object where both percentages are null.
 *
 * @param {import('./parse.js').Usage} usage
 * @param {{ now?: number, env?: NodeJS.ProcessEnv }} [opts]
 * @returns {Snapshot} the snapshot that was written
 */
export function writeSnapshot(usage, opts = {}) {
  const env = opts.env ?? process.env;
  const now = opts.now ?? Date.now();
  const prev = readSnapshot(env);

  /** @type {Snapshot} */
  const next = {
    schema: SNAPSHOT_SCHEMA,
    updatedAt: now,
    fiveHour: usage.fiveHour ?? prev?.fiveHour ?? null,
    sevenDay: usage.sevenDay ?? prev?.sevenDay ?? null,
    fiveHourResetAt: usage.fiveHourResetAt ?? prev?.fiveHourResetAt ?? null,
    sevenDayResetAt: usage.sevenDayResetAt ?? prev?.sevenDayResetAt ?? null,
  };

  const target = snapshotPath(env);
  const dir = path.dirname(target);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

  // Unique-ish temp name without Date.now collisions across rapid renders.
  const tmp = path.join(dir, `.usage.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(next), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, target); // atomic within the same filesystem
  return next;
}
