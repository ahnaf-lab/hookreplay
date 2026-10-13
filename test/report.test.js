'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildDiffReport, formatDiffReportText, formatDiffReportJson } = require('../lib/report');

function replayResults() {
  return [
    {
      sequence: 0,
      timestamp: '2026-01-01T00:00:00.000Z',
      tool_name: 'Bash',
      specifier: 'npm test',
      previous_verdict: 'allow',
      current_verdict: 'allow',
      changed: false,
    },
    {
      sequence: 1,
      timestamp: '2026-01-01T00:00:01.000Z',
      tool_name: 'Bash',
      specifier: 'npm publish',
      previous_verdict: 'ask',
      current_verdict: 'deny',
      changed: true,
    },
    {
      sequence: 2,
      timestamp: '2026-01-01T00:00:02.000Z',
      tool_name: 'Bash',
      specifier: 'rm -rf /tmp/scratch',
      previous_verdict: 'ask',
      current_verdict: 'allow',
      changed: true,
    },
  ];
}

test('buildDiffReport keeps only changed decisions, in cassette order', () => {
  const results = replayResults();
  const summary = { total: 3, changed: 2, unchanged: 1 };

  const report = buildDiffReport({ results, summary });

  assert.equal(report.changes.length, 2);
  assert.deepEqual(report.changes.map((c) => c.sequence), [1, 2]);
  assert.equal(report.changes[0].previous_verdict, 'ask');
  assert.equal(report.changes[0].current_verdict, 'deny');
  assert.equal(report.summary, summary);
});

test('buildDiffReport sorts changes by sequence regardless of input order', () => {
  const results = replayResults().reverse();
  const summary = { total: 3, changed: 2, unchanged: 1 };

  const report = buildDiffReport({ results, summary });

  assert.deepEqual(report.changes.map((c) => c.sequence), [1, 2]);
});

test('formatDiffReportText lists each changed decision old -> new and a summary line', () => {
  const report = buildDiffReport({
    results: replayResults(),
    summary: { total: 3, changed: 2, unchanged: 1 },
  });

  const text = formatDiffReportText(report);

  assert.match(text, /Bash\s+ask -> deny\s+npm publish/);
  assert.match(text, /Bash\s+ask -> allow\s+rm -rf \/tmp\/scratch/);
  assert.match(text, /2 of 3 decision\(s\) changed\.$/);
  assert.doesNotMatch(text, /npm test/);
});

test('formatDiffReportText reports no changes distinctly from an empty cassette', () => {
  const report = buildDiffReport({ results: [], summary: { total: 0, changed: 0, unchanged: 0 } });

  const text = formatDiffReportText(report);

  assert.match(text, /^No decisions changed\./);
  assert.match(text, /0 of 0 decision\(s\) changed\.$/);
});

test('formatDiffReportJson emits parseable JSON matching the report', () => {
  const report = buildDiffReport({
    results: replayResults(),
    summary: { total: 3, changed: 2, unchanged: 1 },
  });

  const parsed = JSON.parse(formatDiffReportJson(report));

  assert.deepEqual(parsed, report);
});

test('formatDiffReportText and formatDiffReportJson are deterministic across repeated calls', () => {
  const report = buildDiffReport({
    results: replayResults(),
    summary: { total: 3, changed: 2, unchanged: 1 },
  });

  assert.equal(formatDiffReportText(report), formatDiffReportText(report));
  assert.equal(formatDiffReportJson(report), formatDiffReportJson(report));
});
