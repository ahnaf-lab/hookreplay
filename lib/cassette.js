'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Produce a stable SHA-256 hash of a JSON-serializable value. Object keys
 * are sorted recursively so the same logical input always hashes the same
 * way regardless of key order.
 */
function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = canonicalize(value[key]);
    }
    return sorted;
  }
  return value;
}

function hashInput(input) {
  const canonical = JSON.stringify(canonicalize(input === undefined ? null : input));
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Append one decision record to a JSONL cassette file, creating parent
 * directories as needed. Each record is written atomically as a single
 * line so concurrent writers never interleave partial lines.
 */
function appendRecord(cassettePath, record) {
  const dir = path.dirname(cassettePath);
  fs.mkdirSync(dir, { recursive: true });
  const line = JSON.stringify(record) + '\n';
  fs.appendFileSync(cassettePath, line, { encoding: 'utf8' });
}

/**
 * Read back every record in a cassette file. Returns an empty array if the
 * file does not exist yet.
 */
function readRecords(cassettePath) {
  if (!fs.existsSync(cassettePath)) {
    return [];
  }
  const contents = fs.readFileSync(cassettePath, 'utf8');
  return contents
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}

module.exports = {
  hashInput,
  appendRecord,
  readRecords,
};
