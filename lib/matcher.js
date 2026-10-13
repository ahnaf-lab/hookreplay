'use strict';

/**
 * Extract the string Claude Code permission rules actually match against
 * for a given tool call. This mirrors the handful of tools that carry a
 * single dominant argument (command, path, url); anything else falls back
 * to the full JSON of the input so a specifier still has something to test.
 */
function primarySpecifier(toolName, toolInput) {
  const input = toolInput || {};
  switch (toolName) {
    case 'Bash':
      return typeof input.command === 'string' ? input.command : '';
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'NotebookEdit':
      return typeof input.file_path === 'string' ? input.file_path : '';
    case 'Glob':
      return typeof input.pattern === 'string' ? input.pattern : '';
    case 'Grep':
      return typeof input.pattern === 'string' ? input.pattern : '';
    case 'WebFetch':
      return typeof input.url === 'string' ? input.url : '';
    default:
      return JSON.stringify(input);
  }
}

/**
 * Parse a Claude Code permission rule string, e.g. "Bash(npm run build:*)"
 * or plain "Read", into its tool name and optional specifier pattern.
 */
function parseRule(rule) {
  const match = /^([A-Za-z_][\w]*)(?:\(([^)]*)\))?$/.exec(rule.trim());
  if (!match) {
    return null;
  }
  return { toolName: match[1], specifier: match[2] === undefined ? null : match[2] };
}

/**
 * Compile a specifier pattern (with `*` wildcards) into a RegExp that is
 * anchored at both ends, matching the whole specifier string.
 */
function compileSpecifierPattern(specifier) {
  const escaped = specifier.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

/**
 * Test whether a single permission rule matches a given tool name and
 * already-extracted specifier string. This is the primitive both the live
 * decision tap (which has the full tool input on hand) and the replay
 * engine (which only has the specifier string recorded in a cassette) test
 * rules with.
 */
function specifierMatches(rule, toolName, specifierValue) {
  const parsed = parseRule(rule);
  if (!parsed || parsed.toolName !== toolName) {
    return false;
  }
  if (parsed.specifier === null) {
    return true;
  }
  return compileSpecifierPattern(parsed.specifier).test(specifierValue || '');
}

/**
 * Test whether a single permission rule matches a given tool call.
 */
function ruleMatches(rule, toolName, toolInput) {
  return specifierMatches(rule, toolName, primarySpecifier(toolName, toolInput));
}

/**
 * Return true if any rule in the list matches the tool call.
 */
function anyRuleMatches(rules, toolName, toolInput) {
  return (rules || []).some((rule) => ruleMatches(rule, toolName, toolInput));
}

/**
 * Return true if any rule in the list matches a given tool name and
 * specifier string directly, without needing the original tool input.
 */
function anySpecifierMatches(rules, toolName, specifierValue) {
  return (rules || []).some((rule) => specifierMatches(rule, toolName, specifierValue));
}

module.exports = {
  primarySpecifier,
  parseRule,
  specifierMatches,
  ruleMatches,
  anyRuleMatches,
  anySpecifierMatches,
};
