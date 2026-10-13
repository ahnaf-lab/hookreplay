#!/usr/bin/env node
'use strict';

const path = require('path');
const { hashInput, appendRecord } = require('../lib/cassette');
const { loadSettings } = require('../lib/settings');
const { resolveVerdict } = require('../lib/verdict');

/**
 * Default cassette location: a dotfile next to wherever the session is
 * running, overridable so tests (and users who want a shared location)
 * don't have to touch the real working directory.
 */
function cassettePathFor(cwd) {
  return process.env.HOOKREPLAY_CASSETTE || path.join(cwd, '.hookreplay', 'cassette.jsonl');
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

/**
 * Build the cassette record for one hook invocation. This is the pure
 * piece under test: given a parsed hook event and the current settings,
 * what gets written to the cassette.
 */
function buildRecord(event, settings, now = new Date()) {
  const toolName = typeof event.tool_name === 'string' ? event.tool_name : 'unknown';
  const toolInput = event.tool_input && typeof event.tool_input === 'object' ? event.tool_input : {};
  return {
    timestamp: now.toISOString(),
    session_id: typeof event.session_id === 'string' ? event.session_id : null,
    hook_event: typeof event.hook_event_name === 'string' ? event.hook_event_name : 'unknown',
    tool_name: toolName,
    input_hash: hashInput(toolInput),
    verdict: resolveVerdict(settings, toolName, toolInput),
  };
}

async function main() {
  const raw = await readStdin();

  let event;
  try {
    event = raw.trim().length > 0 ? JSON.parse(raw) : {};
  } catch (err) {
    // Malformed input must never block the real tool call: record nothing
    // and let Claude Code proceed as if this tap were not installed.
    process.stderr.write(`hookreplay: ignoring unparseable hook input: ${err.message}\n`);
    process.exit(0);
    return;
  }

  const cwd = typeof event.cwd === 'string' ? event.cwd : process.cwd();
  const settings = loadSettings({ cwd });
  const record = buildRecord(event, settings);

  try {
    appendRecord(cassettePathFor(cwd), record);
  } catch (err) {
    process.stderr.write(`hookreplay: failed to write cassette: ${err.message}\n`);
  }

  // Always allow the underlying permission flow to proceed untouched: this
  // tap only observes and records, it never changes what happens.
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { buildRecord, cassettePathFor };
