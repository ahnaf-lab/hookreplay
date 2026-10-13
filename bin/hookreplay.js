#!/usr/bin/env node
'use strict';

const path = require('path');
const { loadCassette } = require('../lib/loader');
const { replayCassette } = require('../lib/replay');
const { buildDiffReport, formatDiffReportText, formatDiffReportJson } = require('../lib/report');

function cassettePathFor(cwd) {
  return process.env.HOOKREPLAY_CASSETTE || path.join(cwd, '.hookreplay', 'cassette.jsonl');
}

function printUsage() {
  process.stdout.write(
    [
      'Usage: hookreplay show [cassette-path]',
      '       hookreplay diff [cassette-path]',
      '       hookreplay report [cassette-path] [--json]',
      '',
      '  show    Print every recorded decision in the cassette, one per line.',
      '  diff    Re-evaluate every recorded decision against the permission rules',
      '          currently on disk and print every one of them (changed or not).',
      '          Exits non-zero if any decision changed.',
      '  report  Re-evaluate every recorded decision and print only the ones',
      '          whose verdict changed, old vs new. Pass --json for machine-',
      '          readable output. Exits non-zero if any decision changed.',
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

function runReport(cassettePath, { json }) {
  const { results, errors, summary } = replayCassette(cassettePath, { cwd: process.cwd() });
  reportErrors(errors);

  const report = buildDiffReport({ results, summary });
  const output = json ? formatDiffReportJson(report) : `${formatDiffReportText(report)}\n`;
  process.stdout.write(output);

  process.exitCode = summary.changed > 0 ? 1 : 0;
}

function main(argv) {
  const [command, ...rest] = argv;

  if (command !== 'show' && command !== 'diff' && command !== 'report') {
    printUsage();
    process.exitCode = command ? 1 : 0;
    return;
  }

  const json = rest.includes('--json');
  const explicitPath = rest.find((arg) => arg !== '--json');
  const cassettePath = explicitPath || cassettePathFor(process.cwd());

  if (command === 'show') {
    runShow(cassettePath);
  } else if (command === 'diff') {
    runDiff(cassettePath);
  } else {
    runReport(cassettePath, { json });
  }
}

main(process.argv.slice(2));
