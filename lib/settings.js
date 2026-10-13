'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function readJsonIfExists(filePath) {
  try {
    const contents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(contents);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

/**
 * Load and merge the permission rule lists Claude Code consults for a
 * project: user settings, project settings, and project-local settings.
 * Later sources are concatenated after earlier ones; callers that need
 * precedence (deny beats ask beats allow) apply that separately.
 */
function loadSettings({ cwd = process.cwd(), home = os.homedir() } = {}) {
  const sources = [
    path.join(home, '.claude', 'settings.json'),
    path.join(cwd, '.claude', 'settings.json'),
    path.join(cwd, '.claude', 'settings.local.json'),
  ];

  const merged = { allow: [], deny: [], ask: [] };
  for (const sourcePath of sources) {
    const parsed = readJsonIfExists(sourcePath);
    const permissions = parsed && typeof parsed === 'object' ? parsed.permissions : null;
    if (!permissions || typeof permissions !== 'object') {
      continue;
    }
    for (const kind of ['allow', 'deny', 'ask']) {
      if (Array.isArray(permissions[kind])) {
        merged[kind].push(...permissions[kind].filter((rule) => typeof rule === 'string'));
      }
    }
  }
  return merged;
}

module.exports = {
  loadSettings,
};
