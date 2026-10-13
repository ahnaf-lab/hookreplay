'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { buildRecord } = require('../hooks/decision-tap');
const { readRecords } = require('../lib/cassette');

test('buildRecord captures tool, input hash, and verdict from a hook event', () => {
  const event = {
    session_id: 'abc123',
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'npm test' },
  };
  const settings = { allow: ['Bash(npm test)'], deny: [], ask: [] };
  const record = buildRecord(event, settings, new Date('2026-01-01T00:00:00.000Z'));

  assert.equal(record.tool_name, 'Bash');
  assert.equal(record.session_id, 'abc123');
  assert.equal(record.hook_event, 'PreToolUse');
  assert.equal(record.verdict, 'allow');
  assert.equal(typeof record.input_hash, 'string');
  assert.equal(record.input_hash.length, 64);
});

test('buildRecord falls back to defaults for a missing tool name', () => {
  const record = buildRecord({}, { allow: [], deny: [], ask: [] }, new Date());
  assert.equal(record.tool_name, 'unknown');
  assert.equal(record.session_id, null);
  assert.equal(record.verdict, 'ask');
});

test('running the hook script end-to-end appends a cassette record', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hookreplay-e2e-'));
  const cassettePath = path.join(dir, 'cassette.jsonl');
  const hookPath = path.join(__dirname, '..', 'hooks', 'decision-tap.js');

  const event = {
    session_id: 'session-1',
    hook_event_name: 'PreToolUse',
    tool_name: 'Read',
    tool_input: { file_path: '/tmp/example.txt' },
    cwd: dir,
  };

  const result = spawnSync(process.execPath, [hookPath], {
    input: JSON.stringify(event),
    encoding: 'utf8',
    env: { ...process.env, HOOKREPLAY_CASSETTE: cassettePath },
  });

  assert.equal(result.status, 0);

  const records = readRecords(cassettePath);
  assert.equal(records.length, 1);
  assert.equal(records[0].tool_name, 'Read');
  assert.equal(records[0].session_id, 'session-1');
});

test('the hook never fails the process on malformed stdin', () => {
  const hookPath = path.join(__dirname, '..', 'hooks', 'decision-tap.js');
  const result = spawnSync(process.execPath, [hookPath], {
    input: '{not valid json',
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
});
