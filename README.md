# hookreplay

A plugin for permission- and hook-driven coding agents that records every
`PreToolUse` permission decision made during a session into a cassette file,
so you can later check whether a change to `settings.json` or your hooks
would make the same tool call resolve differently.

This is the decision-tap milestone: it captures `(tool, input hash, verdict)`
triples into a JSONL cassette. Replaying a cassette against a changed
configuration to flag regressions is a later milestone.

## Install

```sh
npm install
```

To use this as a plugin, point your plugin loader at this directory (it
contains `.claude-plugin/plugin.json` and registers a `PreToolUse` hook in
`hooks/hooks.json`). The hook runs with plain `node` and has no runtime
dependencies.

## Usage

Once installed as a plugin, every tool call that goes through the
`PreToolUse` hook is recorded automatically. Each record contains:

- `timestamp` — when the decision was recorded
- `session_id` — the session the call belonged to
- `hook_event` — which hook fired (`PreToolUse`)
- `tool_name` — the tool being called (`Bash`, `Read`, ...)
- `input_hash` — a SHA-256 hash of the tool input, so the cassette never
  stores raw command text or file contents
- `verdict` — `allow`, `deny`, or `ask`, resolved from the current
  `permissions.allow` / `permissions.deny` / `permissions.ask` rules in
  `.claude/settings.json` (project and user)

The tap never blocks or changes a tool call; it only observes and records.

Records are appended as JSON Lines to `.hookreplay/cassette.jsonl` under the
working directory the hook ran in, or to the path in `$HOOKREPLAY_CASSETTE`
if set.

Inspect a cassette from the command line:

```sh
node bin/hookreplay.js show
node bin/hookreplay.js show path/to/cassette.jsonl
```

Run the test suite:

```sh
npm test
```

### Dependencies

None beyond Node's standard library (`fs`, `path`, `crypto`, `os`, `child_process`)
and the built-in `node:test` runner. Hashing, JSONL I/O, permission-rule
matching, and verdict resolution are all small enough to not justify pulling
in a third-party package.

## Status

Built autonomously, one milestone at a time. Each change is only kept if the
project still builds and its automated tests pass.
