#!/usr/bin/env node
'use strict';

const path = require('path');
const { loadCassette } = require('../lib/loader');
const { replayCassette } = require('../lib/replay');

function cassettePathFor(cwd) {
  return process.env.HOOKREPLAY_CASSETTE || path.join(cwd, '.hookreplay', 'cassette.jsonl');
}

function printUsage() {
  process.stdout.write(
    [
      'Usage: hookreplay show [cassette-path]',
      '       hookreplay diff [cassette-path]',
      '',
      '  show   Print every recorded decision in the cassette, one per line.',
      '  diff   Re-evaluate every recorded decision against the permission rules',
      '         currently on disk and report any whose verdict would now resolve',
      '         differently. Exits non-zero if any decision changed.',
      '',
      'With no path, reads .hookreplay/cassette.jsonl under the current directory',
      '(or $HOOKREPLAY_CASSETTE if set).',
      '',
    ].join('\n')
  );
}

function reportErrors(errors) {
  for (const error of errors) {
    process.stderr.write(`hookreplay: skipping line ${error.line}: ${error.message}\n`);
  }
}

function runShow(cassettePath) {
  const { records, errors } = loadCassette(cassettePath);
  reportErrors(errors);

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

function runDiff(cassettePath) {
  const { results, errors, summary } = replayCassette(cassettePath, { cwd: process.cwd() });
  reportErrors(errors);

  if (summary.total === 0) {
    process.stdout.write(`No decisions recorded yet at ${cassettePath}\n`);
    return;
  }

  for (const result of results) {
    const marker = result.changed ? 'CHANGED' : 'same   ';
    process.stdout.write(
      `${marker}  ${result.tool_name}  ${result.previous_verdict} -> ${result.current_verdict}  ${result.specifier}\n`
    );
  }

  process.stdout.write(
    `\n${summary.changed} of ${summary.total} decision(s) would now resolve differently.\n`
  );

  process.exitCode = summary.changed > 0 ? 1 : 0;
}

function main(argv) {
  const [command, explicitPath] = argv;

  if (command !== 'show' && command !== 'diff') {
    printUsage();
    process.exitCode = command ? 1 : 0;
    return;
  }

  const cassettePath = explicitPath || cassettePathFor(process.cwd());

  if (command === 'show') {
    runShow(cassettePath);
  } else {
    runDiff(cassettePath);
  }
}

main(process.argv.slice(2));
