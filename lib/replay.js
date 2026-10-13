'use strict';

const { loadCassette } = require('./loader');
const { loadSettings } = require('./settings');
const { resolveVerdictForSpecifier } = require('./verdict');

/**
 * Re-evaluate one normalized cassette record against a current set of
 * merged permission rules. Only the `specifier` captured at record time is
 * needed, not the original raw tool input, since that specifier is exactly
 * the string permission rules test against.
 */
function replayRecord(record, settings) {
  const currentVerdict = resolveVerdictForSpecifier(settings, record.tool_name, record.specifier);
  return {
    ...record,
    previous_verdict: record.verdict,
    current_verdict: currentVerdict,
    changed: currentVerdict !== record.verdict,
  };
}

/**
 * Load a cassette and re-evaluate every record against the permission
 * rules currently on disk (or an explicitly supplied `settings` object,
 * mainly for tests). Returns the per-record replay results plus a summary
 * count, so a caller can both inspect individual regressions and gate a
 * build on `summary.changed === 0`.
 */
function replayCassette(cassettePath, { cwd, home, settings } = {}) {
  const { records, errors } = loadCassette(cassettePath);
  const resolvedSettings = settings || loadSettings({ cwd, home });
  const results = records.map((record) => replayRecord(record, resolvedSettings));
  const changed = results.filter((result) => result.changed);

  return {
    results,
    errors,
    summary: {
      total: results.length,
      changed: changed.length,
      unchanged: results.length - changed.length,
    },
  };
}

module.exports = {
  replayRecord,
  replayCassette,
};
