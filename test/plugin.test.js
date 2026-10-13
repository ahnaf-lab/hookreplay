'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.join(__dirname, '..');
const pluginManifestPath = path.join(repoRoot, '.claude-plugin', 'plugin.json');
const commandPath = path.join(repoRoot, 'commands', 'hookreplay.md');
const binPath = path.join(repoRoot, 'bin', 'hookreplay.js');

function tempProjectDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hookreplay-plugin-test-'));
}

function writeSettings(projectDir, permissions) {
  const claudeDir = path.join(projectDir, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({ permissions }));
}

function writeCassette(cassettePath, records) {
  fs.mkdirSync(path.dirname(cassettePath), { recursive: true });
  const lines = records.map((record) => JSON.stringify(record)).join('\n') + '\n';
  fs.writeFileSync(cassettePath, lines, 'utf8');
}

test('plugin.json declares the hooks and commands the plugin registers', () => {
  const manifest = JSON.parse(fs.readFileSync(pluginManifestPath, 'utf8'));

  assert.equal(manifest.name, 'hookreplay');
  assert.equal(manifest.commands, './commands');
  assert.equal(manifest.hooks, './hooks/hooks.json');
  assert.ok(fs.existsSync(path.join(repoRoot, 'commands')), 'commands directory must exist');
  assert.ok(fs.existsSync(path.join(repoRoot, 'hooks', 'hooks.json')), 'hooks.json must exist');
});

test('the /hookreplay command runs the CLI report through CLAUDE_PLUGIN_ROOT', () => {
  const contents = fs.readFileSync(commandPath, 'utf8');

  assert.match(contents, /^---\n/, 'command file must start with frontmatter');
  assert.match(contents, /description:.+/i);
  assert.match(contents, /\$\{CLAUDE_PLUGIN_ROOT\}\/bin\/hookreplay\.js/);
  assert.match(contents, /\breport\b/);
});

test('end to end: the command the plugin runs flags a regressed decision and exits non-zero', () => {
  const projectDir = tempProjectDir();
  writeSettings(projectDir, { allow: [], deny: ['Bash(npm publish*)'], ask: [] });

  const cassettePath = path.join(projectDir, '.hookreplay', 'cassette.jsonl');
  writeCassette(cassettePath, [
    {
      sequence: 0,
      timestamp: '2026-01-01T00:00:00.000Z',
      tool_name: 'Bash',
      specifier: 'npm publish',
      verdict: 'ask',
    },
  ]);

  let output;
  let status = 0;
  try {
    output = execFileSync('node', [binPath, 'report', cassettePath], {
      cwd: projectDir,
      env: { ...process.env, HOME: projectDir },
      encoding: 'utf8',
    });
  } catch (err) {
    output = err.stdout;
    status = err.status;
  }

  assert.equal(status, 1);
  assert.match(output, /ask -> deny/);
  assert.match(output, /npm publish/);
  assert.match(output, /1 of 1 decision\(s\) changed\./);
});

test('end to end: the command exits zero when no recorded decision changed', () => {
  const projectDir = tempProjectDir();
  writeSettings(projectDir, { allow: ['Bash(npm test)'], deny: [], ask: [] });

  const cassettePath = path.join(projectDir, '.hookreplay', 'cassette.jsonl');
  writeCassette(cassettePath, [
    {
      sequence: 0,
      timestamp: '2026-01-01T00:00:00.000Z',
      tool_name: 'Bash',
      specifier: 'npm test',
      verdict: 'allow',
    },
  ]);

  const output = execFileSync('node', [binPath, 'report', cassettePath], {
    cwd: projectDir,
    env: { ...process.env, HOME: projectDir },
    encoding: 'utf8',
  });

  assert.match(output, /No decisions changed\./);
});
