'use strict';

const { anyRuleMatches, anySpecifierMatches } = require('./matcher');

/**
 * Resolve the permission verdict for a tool call against a set of merged
 * allow/deny/ask rules, using Claude Code's own precedence: an explicit
 * deny always wins, then an explicit allow, then an explicit ask. A call
 * that matches no rule at all is left for the normal prompt flow, which
 * this tap reports as "ask" since that is the safe, user-facing default.
 */
function resolveVerdict(settings, toolName, toolInput) {
  if (anyRuleMatches(settings.deny, toolName, toolInput)) {
    return 'deny';
  }
  if (anyRuleMatches(settings.allow, toolName, toolInput)) {
    return 'allow';
  }
  if (anyRuleMatches(settings.ask, toolName, toolInput)) {
    return 'ask';
  }
  return 'ask';
}

/**
 * Resolve the permission verdict for a tool name and specifier string
 * directly, using the same precedence as resolveVerdict. This is the
 * variant the replay engine uses: a cassette only ever records the
 * specifier string a rule would have tested (never the full original tool
 * input), so replay needs to apply rules to that string without going
 * through primarySpecifier again.
 */
function resolveVerdictForSpecifier(settings, toolName, specifierValue) {
  if (anySpecifierMatches(settings.deny, toolName, specifierValue)) {
    return 'deny';
  }
  if (anySpecifierMatches(settings.allow, toolName, specifierValue)) {
    return 'allow';
  }
  if (anySpecifierMatches(settings.ask, toolName, specifierValue)) {
    return 'ask';
  }
  return 'ask';
}

module.exports = {
  resolveVerdict,
  resolveVerdictForSpecifier,
};
