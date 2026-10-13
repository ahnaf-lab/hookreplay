#!/usr/bin/env node
'use strict';

const path = require('path');
const { loadCassette } = require('../lib/loader');

function cassettePathFor(cwd) {
  return process.env.HOOKREPLAY_CASSETTE || path.join(cwd, '.hookreplay', 'cassette.jsonl');
}

function printUsage() {
  process.stdout.write(
    [
      'Usage: hookreplay show [cassette-path]',
      '',
      '  show   Print every recorded decision in the cassette, one per line.',
      '',
      'With no path, reads .hookreplay/cassette.jsonl under the current directory',
      '(or $HOOKREPLAY_CASSETTE if set).',
      '',
    ].join('\n')
  );
}

function main(argv) {
  const [command, explicitPath] = argv;

  if (command !== 'show') {
    printUsage();
    process.exitCode = command ? 1 : 0;
    return;
  }

  const cassettePath = explicitPath || cassettePathFor(process.cwd());
  const { records, errors } = loadCassette(cassettePath);

  for (const error of errors) {
    process.stderr.write(`hookreplay: skipping line ${error.line}: ${error.message}\n`);
  }

  if (records.length === 0) {
    process.stdout.write(`No decisions recorded yet at ${cassettePath}\n`);
    return;
  }

  for (const record of records) {
    process.stdout.write(
      `${record.timestamp}  ${record.tool_name}  ${record.verdict}  ${record.input_hash}\n`
    );
  }
}

main(process.argv.slice(2));
