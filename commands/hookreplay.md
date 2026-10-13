---
description: Replay a hookreplay cassette against the current settings and hooks, and report any decision that would now resolve differently
argument-hint: [cassette-path] [--json]
allowed-tools: Bash(node:*)
---

Run the hookreplay diff report and present its result to the user.

!`node "${CLAUDE_PLUGIN_ROOT}/bin/hookreplay.js" report $ARGUMENTS`

The command above printed the full diff report: every recorded decision
whose verdict would now resolve differently against the current
`settings.json` and hooks, old verdict vs new verdict, plus a summary line.
A non-zero exit status means at least one decision changed.

Relay that output to the user as-is, then briefly call out whether the run
passed (no changes) or needs attention (one or more changed decisions), and
which tool calls/specifiers are responsible.
