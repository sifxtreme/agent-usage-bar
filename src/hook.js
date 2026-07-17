import { execFileSync } from 'node:child_process';
import { parseStatuslinePayload } from './parse.js';
import { writeSnapshot } from './snapshot.js';
import { fmtPercent } from './format.js';

/**
 * Read all of stdin as a string.
 * @param {import('node:stream').Readable & { isTTY?: boolean }} [stream]
 * @returns {Promise<string>}
 */
export function readStdin(stream = process.stdin) {
  return new Promise((resolve) => {
    let data = '';
    if (stream.isTTY) {
      resolve('');
      return;
    }
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      data += chunk;
    });
    stream.on('end', () => resolve(data));
    stream.on('error', () => resolve(data));
  });
}

/**
 * Compact one-line statusline string, e.g. "⧗ 5h 9% · wk 22%".
 * @param {import('./parse.js').Usage} usage
 * @returns {string}
 */
export function compactLine(usage) {
  return `⧗ 5h ${fmtPercent(usage.fiveHour)} · wk ${fmtPercent(usage.sevenDay)}`;
}

/**
 * The statusline hook: Claude Code invokes this on every render with the
 * session JSON on stdin. We extract rate limits, persist them to the snapshot
 * that the menu bar reads, then print a status line.
 *
 * Print modes (argv after `hook`):
 *   (default)         print our own compact usage line
 *   --quiet           print nothing (use when another tool owns your statusline)
 *   --wrap "<cmd>"    delegate the visible line to <cmd>, feeding it the same
 *                     stdin; we still side-write the snapshot
 *
 * @param {{ argv?: string[], stdin?: import('node:stream').Readable & { isTTY?: boolean }, now?: number, env?: NodeJS.ProcessEnv, log?: (s: string) => void }} [deps]
 * @returns {Promise<void>}
 */
export async function runHook(deps = {}) {
  const argv = deps.argv ?? process.argv.slice(3);
  const env = deps.env ?? process.env;
  const log = deps.log ?? ((s) => process.stdout.write(s.endsWith('\n') ? s : s + '\n'));

  const raw = await readStdin(deps.stdin);

  /** @type {unknown} */
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  const usage = parseStatuslinePayload(payload);
  if (usage) {
    try {
      writeSnapshot(usage, { now: deps.now ?? Date.now(), env });
    } catch {
      // Never let a snapshot write break the user's statusline.
    }
  }

  // --- decide what to print as the visible statusline ---
  if (argv.includes('--quiet')) return;

  const wrapIdx = argv.indexOf('--wrap');
  const wrapCmd = wrapIdx !== -1 ? argv[wrapIdx + 1] : undefined;
  if (wrapCmd) {
    try {
      const out = execFileSync('/bin/sh', ['-c', wrapCmd], {
        input: raw,
        encoding: 'utf8',
        timeout: 5000,
      });
      process.stdout.write(out);
    } catch {
      // Wrapped command failed — fall back to our own line if we have data.
      if (usage) log(compactLine(usage));
    }
    return;
  }

  if (usage) log(compactLine(usage));
}
