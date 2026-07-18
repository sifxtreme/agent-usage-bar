import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseListPid } from '../src/launchctl.js';

// Real `launchctl list <label>` output when the app is running.
const RUNNING = `{
	"LimitLoadToSessionType" = "Aqua";
	"Label" = "com.agent-usage-bar.menubar";
	"OnDemand" = false;
	"LastExitStatus" = 0;
	"PID" = 51915;
	"Program" = "/Users/x/bin-native/agent-usage-menubar";
};`;

// Loaded but stopped (clean Quit): no "PID" line — the case that bit us.
const STOPPED = `{
	"Label" = "com.agent-usage-bar.menubar";
	"OnDemand" = false;
	"LastExitStatus" = 0;
};`;

test('parseListPid reads the live PID when running', () => {
  assert.equal(parseListPid(RUNNING), 51915);
});

test('parseListPid is null when loaded but not running', () => {
  assert.equal(parseListPid(STOPPED), null);
});

test('parseListPid is null for empty / not-loaded output', () => {
  assert.equal(parseListPid(''), null);
});
