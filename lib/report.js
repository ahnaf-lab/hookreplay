'use strict';

/**
 * Build a deterministic diff report from a replay result: just the fields
 * relevant to a changed decision (old vs new verdict), restricted to
 * records whose verdict actually changed, and sorted by `sequence` (the
 * cassette's file order) so the same cassette and settings always produce
 * byte-identical output regardless of how the replay engine iterated.
 */
function buildDiffReport({ results, summary }) {
  const changes = results
    .filter((result) => result.changed)
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((result) => ({
      sequence: result.sequence,
      timestamp: result.timestamp,
      tool_name: result.tool_name,
      specifier: result.specifier,
      previous_verdict: result.previous_verdict,
      current_verdict: result.current_verdict,
    }));

  return {
    summary,
    changes,
  };
}

/**
 * Render a diff report as deterministic, human-readable text: one line per
 * changed decision in cassette file order, then a trailing summary line.
 * Emits a fixed "No decisions changed." line rather than empty output when
 * nothing changed, so a report is never ambiguous with a failed run that
 * produced no output at all.
 */
function formatDiffReportText(report) {
  const lines = report.changes.map(
    (change) =>
      `${change.tool_name}  ${change.previous_verdict} -> ${change.current_verdict}  ${change.specifier}`
  );

  if (lines.length === 0) {
    lines.push('No decisions changed.');
  }

  lines.push('');
  lines.push(`${report.summary.changed} of ${report.summary.total} decision(s) changed.`);

  return lines.join('\n');
}

/**
 * Render a diff report as JSON text with a fixed key order and indentation,
 * so the same report object always serializes to the same bytes.
 */
function formatDiffReportJson(report) {
  return `${JSON.stringify(report, null, 2)}\n`;
}

module.exports = {
  buildDiffReport,
  formatDiffReportText,
  formatDiffReportJson,
};
