'use strict';

const fs = require('fs');

/**
 * The verdict values a cassette record can carry. Anything else observed on
 * disk (hand-edited file, future format) is normalized to 'unknown' rather
 * than rejected, so a loader can always produce a full record list.
 */
const VERDICTS = ['allow', 'deny', 'ask'];

function asStringOrDefault(value, fallback) {
  return typeof value === 'string' ? value : fallback;
}

function asVerdict(value) {
  return VERDICTS.includes(value) ? value : 'unknown';
}

/**
 * Normalize one already-JSON-parsed cassette line into the stable record
 * shape the rest of the tool relies on. Every field is always present and
 * typed, regardless of what the raw line did or didn't contain, so callers
 * never need to guard against missing keys.
 *
 * `sequence` is the record's 0-based position among successfully parsed
 * records in the file; it is the authoritative ordering key, independent of
 * `timestamp`, since two decisions can share a timestamp at clock
 * resolution but never share a position in the file.
 *
 * `specifier` is the string permission rules test against (a Bash command,
 * a file path, ...); it is what the replay engine re-evaluates against
 * current rules.
 */
function normalizeRecord(raw, sequence) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`cassette record must be a JSON object, got ${JSON.stringify(raw)}`);
  }
  return {
    sequence,
    timestamp: asStringOrDefault(raw.timestamp, null),
    session_id: asStringOrDefault(raw.session_id, null),
    hook_event: asStringOrDefault(raw.hook_event, 'unknown'),
    tool_name: asStringOrDefault(raw.tool_name, 'unknown'),
    // Records written before replay existed never captured a specifier;
    // default to '' so those lines still load, even though a rule whose
    // specifier pattern requires non-empty text can never replay as a match
    // for them.
    specifier: asStringOrDefault(raw.specifier, ''),
    input_hash: asStringOrDefault(raw.input_hash, null),
    verdict: asVerdict(raw.verdict),
  };
}

/**
 * Parse one raw line of a JSONL cassette into a normalized record. Returns
 * either `{ ok: true, record }` or `{ ok: false, error }`; never throws, so
 * a single corrupt line never prevents the rest of the cassette from
 * loading.
 */
function parseLine(line, lineNumber, sequence) {
  let raw;
  try {
    raw = JSON.parse(line);
  } catch (err) {
    return { ok: false, error: { line: lineNumber, raw: line, message: `invalid JSON: ${err.message}` } };
  }
  try {
    return { ok: true, record: normalizeRecord(raw, sequence) };
  } catch (err) {
    return { ok: false, error: { line: lineNumber, raw: line, message: err.message } };
  }
}

/**
 * Load a JSONL cassette into an ordered list of normalized decision
 * records plus any per-line errors encountered along the way. The returned
 * `records` array preserves file order via `sequence`; `errors` describes
 * lines that could not be parsed, keyed by 1-based line number, so a caller
 * can surface warnings without losing the rest of the cassette.
 *
 * A missing file is treated as an empty cassette, not an error: a session
 * that has not recorded anything yet is a normal starting state.
 */
function loadCassette(cassettePath) {
  if (!fs.existsSync(cassettePath)) {
    return { records: [], errors: [] };
  }

  const contents = fs.readFileSync(cassettePath, 'utf8');
  const lines = contents.split('\n');

  const records = [];
  const errors = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line.length === 0) {
      continue;
    }
    const result = parseLine(line, i + 1, records.length);
    if (result.ok) {
      records.push(result.record);
    } else {
      errors.push(result.error);
    }
  }

  return { records, errors };
}

module.exports = {
  VERDICTS,
  normalizeRecord,
  parseLine,
  loadCassette,
};
