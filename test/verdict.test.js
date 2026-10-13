'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveVerdict } = require('../lib/verdict');

test('deny rule wins even when an allow rule also matches', () => {
  const settings = { allow: ['Bash(*)'], deny: ['Bash(rm -rf *)'], ask: [] };
  const verdict = resolveVerdict(settings, 'Bash', { command: 'rm -rf /tmp/scratch' });
  assert.equal(verdict, 'deny');
});

test('allow rule wins when no deny rule matches', () => {
  const settings = { allow: ['Bash(npm test)'], deny: [], ask: [] };
  const verdict = resolveVerdict(settings, 'Bash', { command: 'npm test' });
  assert.equal(verdict, 'allow');
});

test('explicit ask rule is reported as ask', () => {
  const settings = { allow: [], deny: [], ask: ['Bash(git push*)'] };
  const verdict = resolveVerdict(settings, 'Bash', { command: 'git push origin main' });
  assert.equal(verdict, 'ask');
});

test('no matching rule defaults to ask', () => {
  const settings = { allow: [], deny: [], ask: [] };
  const verdict = resolveVerdict(settings, 'Bash', { command: 'echo hi' });
  assert.equal(verdict, 'ask');
});
