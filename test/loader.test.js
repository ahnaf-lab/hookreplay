'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { loadCassette, normalizeRecord } = require('../lib/loader');

function tempCassettePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hookreplay-loader-test-'));
  return path.join(dir, 'cassette.jsonl');
}

function writeLines(cassettePath, lines) {
  fs.writeFileSync(cassettePath, lines.join('\n') + '\n', 'utf8');
}

test('loadCassette returns records in file order with a sequence per record', () => {
  const cassettePath = tempCassettePath();
  writeLines(cassettePath, [
    JSON.stringify({ tool_name: 'Bash', verdict: 'allow' }),
    JSON.stringify({ tool_name: 'Read', verdict: 'ask' }),
    JSON.stringify({ tool_name: 'Write', verdict: 'deny' }),
  ]);

  const { records, errors } = loadCassette(cassettePath);

  assert.equal(errors.length, 0);
  assert.deepEqual(records.map((r) => r.sequence), [0, 1, 2]);
  assert.deepEqual(records.map((r) => r.tool_name), ['Bash', 'Read', 'Write']);
});

test('loadCassette fills in a stable schema for records missing fields', () => {
  const cassettePath = tempCassettePath();
  writeLines(cassettePath, [JSON.stringify({ tool_name: 'Bash' })]);

  const { records } = loadCassette(cassettePath);

  assert.equal(records.length, 1);
  assert.deepEqual(Object.keys(records[0]).sort(), [
    'hook_event',
    'input_hash',
    'session_id',
    'sequence',
    'specifier',
    'tool_name',
    'timestamp',
    'verdict',
  ].sort());
  assert.equal(records[0].session_id, null);
  assert.equal(records[0].hook_event, 'unknown');
  assert.equal(records[0].verdict, 'unknown');
  assert.equal(records[0].specifier, '');
});

test('loadCassette skips an unparseable line and reports it without dropping valid lines', () => {
  const cassettePath = tempCassettePath();
  writeLines(cassettePath, [
    JSON.stringify({ tool_name: 'Bash', verdict: 'allow' }),
    '{ not valid json',
    JSON.stringify({ tool_name: 'Read', verdict: 'deny' }),
  ]);

  const { records, errors } = loadCassette(cassettePath);

  assert.equal(records.length, 2);
  assert.deepEqual(records.map((r) => r.tool_name), ['Bash', 'Read']);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].line, 2);
  assert.match(errors[0].message, /invalid JSON/);
});

test('loadCassette normalizes an unrecognized verdict value to "unknown"', () => {
  const cassettePath = tempCassettePath();
  writeLines(cassettePath, [JSON.stringify({ tool_name: 'Bash', verdict: 'maybe' })]);

  const { records } = loadCassette(cassettePath);
  assert.equal(records[0].verdict, 'unknown');
});

test('loadCassette treats a missing file as an empty cassette', () => {
  const missingPath = path.join(os.tmpdir(), 'hookreplay-loader-missing', 'cassette.jsonl');
  assert.deepEqual(loadCassette(missingPath), { records: [], errors: [] });
});

test('normalizeRecord rejects a line that parsed to a non-object', () => {
  assert.throws(() => normalizeRecord('just a string', 0), /must be a JSON object/);
  assert.throws(() => normalizeRecord([1, 2, 3], 0), /must be a JSON object/);
});
