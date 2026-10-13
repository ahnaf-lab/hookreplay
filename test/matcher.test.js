'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { ruleMatches, anyRuleMatches, specifierMatches, anySpecifierMatches } = require('../lib/matcher');

test('rule without specifier matches any input for that tool', () => {
  assert.ok(ruleMatches('Read', 'Read', { file_path: '/anything' }));
});

test('rule with wildcard specifier matches a prefix pattern', () => {
  assert.ok(ruleMatches('Bash(npm run build:*)', 'Bash', { command: 'npm run build:prod' }));
});

test('rule with wildcard specifier rejects a non-matching command', () => {
  assert.equal(ruleMatches('Bash(npm run build:*)', 'Bash', { command: 'rm -rf /' }), false);
});

test('rule for a different tool never matches', () => {
  assert.equal(ruleMatches('Read(*)', 'Write', { file_path: '/etc/passwd' }), false);
});

test('anyRuleMatches is true when at least one rule in the list matches', () => {
  const rules = ['Read(/safe/*)', 'Bash(npm test)'];
  assert.ok(anyRuleMatches(rules, 'Bash', { command: 'npm test' }));
  assert.equal(anyRuleMatches(rules, 'Bash', { command: 'npm publish' }), false);
});

test('specifierMatches tests a specifier string directly, without a tool input object', () => {
  assert.ok(specifierMatches('Bash(npm run build:*)', 'Bash', 'npm run build:prod'));
  assert.equal(specifierMatches('Bash(npm run build:*)', 'Bash', 'rm -rf /'), false);
  assert.equal(specifierMatches('Bash(npm test)', 'Write', 'npm test'), false);
});

test('anySpecifierMatches is true when at least one rule matches the specifier', () => {
  const rules = ['Read(/safe/*)', 'Bash(npm test)'];
  assert.ok(anySpecifierMatches(rules, 'Bash', 'npm test'));
  assert.equal(anySpecifierMatches(rules, 'Bash', 'npm publish'), false);
});
