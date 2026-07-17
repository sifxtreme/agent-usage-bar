import { execFileSync } from 'node:child_process';

const DEFAULT_FONT = '/System/Library/Fonts/Menlo.ttc';

/**
 * ImageMagick binary (override with AGENT_USAGE_BAR_MAGICK).
 * @param {NodeJS.ProcessEnv} env
 */
function magickBin(env) {
  return env.AGENT_USAGE_BAR_MAGICK?.trim() || 'magick';
}

/**
 * Font file for the stacked image (override with AGENT_USAGE_BAR_IMAGE_FONT).
 * @param {NodeJS.ProcessEnv} env
 */
function imageFont(env) {
  return env.AGENT_USAGE_BAR_IMAGE_FONT?.trim() || DEFAULT_FONT;
}

/**
 * Render two stacked text lines to a base64 PNG using ImageMagick.
 *
 * Produced as a TEMPLATE image (black on transparent): SwiftBar's
 * `templateImage=` recolors it to match the menu bar (white on dark). Height is
 * fixed at 44px = 2× a 22pt menu bar so it stays crisp on Retina.
 *
 * Requires ImageMagick (`magick`). Returns null on any failure so the caller
 * can fall back to plain text — the tool never breaks if magick is missing.
 *
 * @param {string} line1
 * @param {string} line2
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string | null} base64 PNG, or null
 */
export function buildStackImage(line1, line2, env = process.env) {
  try {
    const out = execFileSync(
      magickBin(env),
      [
        '-background', 'none',
        '-fill', 'black',
        '-font', imageFont(env),
        '-pointsize', '40',
        '-interline-spacing', '2',
        `label:${line1}\n${line2}`,
        '-trim', '+repage',
        '-resize', 'x44',
        'png:-',
      ],
      { maxBuffer: 1024 * 1024, timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return out.length > 0 ? Buffer.from(out).toString('base64') : null;
  } catch {
    return null;
  }
}

/**
 * One stacked row: label + right-aligned percentage, e.g. "5h  17%", "wk  --".
 * @param {string} label @param {number | null} pct
 */
export function stackLabel(label, pct) {
  const value = pct === null ? '--' : `${pct}%`;
  return `${label} ${value.padStart(4)}`;
}
