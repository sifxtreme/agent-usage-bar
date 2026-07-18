#!/usr/bin/env node
import { runHook } from '../src/hook.js';
import { renderSwiftBar } from '../src/render.js';
import { readSnapshot } from '../src/snapshot.js';
import { runDoctor } from '../src/doctor.js';
import { snapshotPath } from '../src/constants.js';

const HELP = `agent-usage-bar — Claude Code + Codex usage in your macOS menu bar

Usage:
  agent-usage-bar hook [--quiet | --wrap "<cmd>"]   statusLine hook: writes the snapshot
  agent-usage-bar restart                           (re)start the menu-bar app — use if you quit it
  agent-usage-bar stop                              stop the menu-bar app until next login
  agent-usage-bar render                            print SwiftBar/xbar menu-bar output
  agent-usage-bar doctor                            check setup + health
  agent-usage-bar path                              print the snapshot file path
  agent-usage-bar --version                         print version
  agent-usage-bar --help                            this help

Setup (see README):
  1. "statusLine": { "type": "command", "command": "agent-usage-bar hook" }  in ~/.claude/settings.json
  2. ./native/install.sh   (native app, recommended)  — or  brew install --cask swiftbar
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

    case 'restart':
    case 'start': {
      const { restartAgent } = await import('../src/launchctl.js');
      const r = restartAgent();
      process.stdout.write(`agent-usage-bar: ${r.message}\n`);
      process.exit(r.ok ? 0 : 1);
    }

    case 'stop': {
      const { stopAgent } = await import('../src/launchctl.js');
      const r = stopAgent();
      process.stdout.write(`agent-usage-bar: ${r.message}\n`);
      process.exit(r.ok ? 0 : 1);
    }

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
  process.stderr.write(`agent-usage-bar: ${err?.message ?? err}\n`);
  process.exit(1);
});
