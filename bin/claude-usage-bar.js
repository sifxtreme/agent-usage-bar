#!/usr/bin/env node
import { runHook } from '../src/hook.js';
import { renderSwiftBar } from '../src/render.js';
import { readSnapshot } from '../src/snapshot.js';
import { runDoctor } from '../src/doctor.js';
import { snapshotPath } from '../src/constants.js';

const HELP = `claude-usage-bar — Claude Code 5h + weekly usage in your macOS menu bar

Usage:
  claude-usage-bar hook [--quiet | --wrap "<cmd>"]   statusLine hook: writes the snapshot
  claude-usage-bar render                            print SwiftBar/xbar menu-bar output
  claude-usage-bar doctor                            check setup + health
  claude-usage-bar path                              print the snapshot file path
  claude-usage-bar --version                         print version
  claude-usage-bar --help                            this help

Setup (see README):
  1. "statusLine": { "type": "command", "command": "claude-usage-bar hook" }  in ~/.claude/settings.json
  2. brew install --cask swiftbar   (point it at plugins/)
`;

async function main() {
  const cmd = process.argv[2];

  switch (cmd) {
    case 'hook':
      await runHook();
      return;

    case 'render':
      process.stdout.write(renderSwiftBar(readSnapshot()) + '\n');
      return;

    case 'doctor':
      process.exit(runDoctor());
      return;

    case 'path':
      process.stdout.write(snapshotPath() + '\n');
      return;

    case '--version':
    case '-v': {
      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const pkgUrl = new URL('../package.json', import.meta.url);
      const pkg = JSON.parse(readFileSync(fileURLToPath(pkgUrl), 'utf8'));
      process.stdout.write(pkg.version + '\n');
      return;
    }

    case '--help':
    case '-h':
    case undefined:
      process.stdout.write(HELP);
      return;

    default:
      process.stderr.write(`Unknown command: ${cmd}\n\n${HELP}`);
      process.exit(2);
  }
}

main().catch((err) => {
  process.stderr.write(`claude-usage-bar: ${err?.message ?? err}\n`);
  process.exit(1);
});
