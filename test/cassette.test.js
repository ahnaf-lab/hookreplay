'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { hashInput, appendRecord, readRecords } = require('../lib/cassette');

function tempCassettePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hookreplay-test-'));
  return path.join(dir, 'cassette.jsonl');
}

test('hashInput is stable regardless of key order', () => {
  const a = hashInput({ command: 'ls', flag: true });
  const b = hashInput({ flag: true, command: 'ls' });
  assert.equal(a, b);
});

test('hashInput differs for different inputs', () => {
  const a = hashInput({ command: 'ls' });
  const b = hashInput({ command: 'rm -rf /' });
  assert.notEqual(a, b);
});

test('appendRecord then readRecords round-trips entries in order', () => {
  const cassettePath = tempCassettePath();
  appendRecord(cassettePath, { tool_name: 'Bash', verdict: 'allow' });
  appendRecord(cassettePath, { tool_name: 'Read', verdict: 'ask' });

  const records = readRecords(cassettePath);
  assert.equal(records.length, 2);
  assert.equal(records[0].tool_name, 'Bash');
  assert.equal(records[1].verdict, 'ask');
});

test('readRecords returns empty array for missing file', () => {
  const missingPath = path.join(os.tmpdir(), 'hookreplay-does-not-exist', 'cassette.jsonl');
  assert.deepEqual(readRecords(missingPath), []);
});

test('appendRecord creates parent directories as needed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hookreplay-test-'));
  const nestedPath = path.join(dir, 'nested', 'deep', 'cassette.jsonl');
  appendRecord(nestedPath, { tool_name: 'Write', verdict: 'deny' });
  assert.ok(fs.existsSync(nestedPath));
  assert.equal(readRecords(nestedPath).length, 1);
});
