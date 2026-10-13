'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { replayRecord, replayCassette } = require('../lib/replay');
const { appendRecord } = require('../lib/cassette');

function tempCassettePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hookreplay-replay-test-'));
  return path.join(dir, 'cassette.jsonl');
}

test('replayRecord flags a decision whose verdict changed under new settings', () => {
  const record = {
    sequence: 0,
    tool_name: 'Bash',
    specifier: 'npm publish',
    verdict: 'ask',
  };
  const settings = { allow: [], deny: ['Bash(npm publish*)'], ask: [] };

  const result = replayRecord(record, settings);

  assert.equal(result.previous_verdict, 'ask');
  assert.equal(result.current_verdict, 'deny');
  assert.equal(result.changed, true);
});

test('replayRecord reports no change when the verdict still resolves the same way', () => {
  const record = {
    sequence: 0,
    tool_name: 'Bash',
    specifier: 'npm test',
    verdict: 'allow',
  };
  const settings = { allow: ['Bash(npm test)'], deny: [], ask: [] };

  const result = replayRecord(record, settings);

  assert.equal(result.current_verdict, 'allow');
  assert.equal(result.changed, false);
});

test('replayCassette re-evaluates every recorded decision and summarizes changes', () => {
  const cassettePath = tempCassettePath();
  appendRecord(cassettePath, {
    tool_name: 'Bash',
    specifier: 'npm test',
    verdict: 'allow',
  });
  appendRecord(cassettePath, {
    tool_name: 'Bash',
    specifier: 'rm -rf /tmp/scratch',
    verdict: 'ask',
  });

  // Current settings now explicitly deny the rm command that used to fall
  // through to the default "ask", while still allowing npm test.
  const settings = { allow: ['Bash(npm test)'], deny: ['Bash(rm -rf *)'], ask: [] };

  const { results, errors, summary } = replayCassette(cassettePath, { settings });

  assert.equal(errors.length, 0);
  assert.equal(summary.total, 2);
  assert.equal(summary.changed, 1);
  assert.equal(summary.unchanged, 1);

  const unchanged = results.find((r) => r.specifier === 'npm test');
  const changed = results.find((r) => r.specifier === 'rm -rf /tmp/scratch');
  assert.equal(unchanged.changed, false);
  assert.equal(changed.previous_verdict, 'ask');
  assert.equal(changed.current_verdict, 'deny');
  assert.equal(changed.changed, true);
});

test('replayCassette treats a missing cassette file as zero recorded decisions', () => {
  const missingPath = path.join(os.tmpdir(), 'hookreplay-replay-missing', 'cassette.jsonl');
  const { results, summary } = replayCassette(missingPath, {
    settings: { allow: [], deny: [], ask: [] },
  });

  assert.deepEqual(results, []);
  assert.equal(summary.total, 0);
  assert.equal(summary.changed, 0);
});
