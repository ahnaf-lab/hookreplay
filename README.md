# hookreplay

A plugin for permission- and hook-driven coding agents that records every
`PreToolUse` permission decision made during a session into a cassette file,
so you can later check whether a change to `settings.json` or your hooks
would make the same tool call resolve differently.

This is the plugin wiring milestone: the recorder, loader, replay engine,
and diff report from earlier milestones are now exposed as an installable
plugin, with a `/hookreplay` command that runs the full report from inside
a session.

## Install

```sh
npm install
```

To use this as a plugin, point your plugin loader at this directory. It
contains `.claude-plugin/plugin.json`, which registers:

- a `PreToolUse` hook (`hooks/hooks.json`) that records every decision, and
- a `/hookreplay` command (`commands/hookreplay.md`) that replays the
  cassette and reports the result.

Both run with plain `node` and have no runtime dependencies.

## Usage

### `/hookreplay` command

Once installed as a plugin, run the full diff report from inside a session:

```
/hookreplay
/hookreplay path/to/cassette.jsonl
/hookreplay --json
```

The command shells out to `bin/hookreplay.js report`, using
`${CLAUDE_PLUGIN_ROOT}` so it works regardless of where the plugin is
installed, and relays the same text (or `--json`) output documented under
"Diff report" below, so the result inside a session is identical to running
the CLI directly.

### Decision tap

Once installed as a plugin, every tool call that goes through the
`PreToolUse` hook is recorded automatically. Each record contains:

- `timestamp` — when the decision was recorded
- `session_id` — the session the call belonged to
- `hook_event` — which hook fired (`PreToolUse`)
- `tool_name` — the tool being called (`Bash`, `Read`, ...)
- `specifier` — the string permission rules actually test against for that
  tool (a `Bash` command, a `Read`/`Write`/`Edit` file path, a `Glob`/`Grep`
  pattern, a `WebFetch` url), i.e. the same value a rule like
  `Bash(npm run build:*)` matches with its wildcard. This is the minimum
  slice of the tool input the replay engine needs to re-test a decision
  against new rules; other tool input fields (such as file contents written
  by `Write`) are never recorded.
- `input_hash` — a SHA-256 hash of the full tool input, kept alongside
  `specifier` as an integrity signal
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

### Replay

Re-evaluate every recorded decision against the permission rules currently on
disk, and report any whose verdict would now resolve differently:

```sh
node bin/hookreplay.js diff
node bin/hookreplay.js diff path/to/cassette.jsonl
```

Each line shows the tool, the previous verdict, the current verdict, and the
specifier that was tested, for example:

```
CHANGED  Bash  ask -> allow  npm run build:prod
same     Bash  allow -> allow  npm test
```

`diff` exits with status `1` if any decision changed (and `0` otherwise), so
it can gate a CI job: a passing run means the current `settings.json` and
hooks still resolve every recorded decision the same way the session that
captured the cassette did.

### Diff report

`diff` prints every recorded decision, changed or not. To see only the
regressions, old verdict vs new, use `report`:

```sh
node bin/hookreplay.js report
node bin/hookreplay.js report path/to/cassette.jsonl
node bin/hookreplay.js report --json
```

Text output lists one line per changed decision, in cassette file order, and
a trailing summary line:

```
Bash  ask -> deny  rm -rf /tmp/scratch

1 of 3 decision(s) changed.
```

If nothing changed, it prints `No decisions changed.` instead of an empty
line, so a clean run is never confused with a run that produced no output at
all. `--json` prints the same data as a single JSON object
(`{ summary, changes }`) for scripting; both forms are deterministic, so the
same cassette and the same settings always produce byte-identical output.
`report` exits with status `1` if any decision changed, same as `diff`.

Programmatically, `lib/report.js` exposes:

- `buildDiffReport({ results, summary })` — takes the output of
  `replayCassette` and returns `{ summary, changes }`, where `changes` is
  only the records whose verdict changed, sorted by `sequence`, each
  trimmed to `{ sequence, timestamp, tool_name, specifier,
  previous_verdict, current_verdict }`.
- `formatDiffReportText(report)` / `formatDiffReportJson(report)` — render
  that report as the text or JSON shown above.

Programmatically, `lib/replay.js` exposes:

- `replayRecord(record, settings)` — re-evaluate one normalized cassette
  record against a merged `{ allow, deny, ask }` rule set (as returned by
  `loadSettings`), returning the record plus `previous_verdict`,
  `current_verdict`, and `changed`.
- `replayCassette(cassettePath, options)` — load a cassette and replay every
  record, returning `{ results, errors, summary }`, where `summary` is
  `{ total, changed, unchanged }`. By default it loads settings from the
  current directory the same way the decision tap does; pass
  `{ settings }` directly to replay against an arbitrary rule set instead
  (mainly useful for tests or "what if" comparisons).

### Cassette loader

`lib/loader.js` turns a raw JSONL cassette into an ordered list of decision
records with a stable schema. `loadCassette(path)` returns
`{ records, errors }`:

- `records` — every successfully parsed line, normalized to always carry
  `sequence`, `timestamp`, `session_id`, `hook_event`, `tool_name`,
  `specifier`, `input_hash`, and `verdict`, with safe defaults
  (`null`/`"unknown"`/`""`) for any field a line left out. `sequence` is the
  record's 0-based position among the successfully parsed records, which is
  the ordering key the replay engine relies on — it stays stable even if two
  records happen to share a `timestamp` at clock resolution. A cassette
  recorded before this milestone has no `specifier` field and normalizes to
  `""`, which only replays correctly against rules with no specifier at all.
- `errors` — one entry per line that failed to parse or validate
  (`{ line, raw, message }`). A corrupt or hand-edited line is reported, not
  thrown, so the rest of the cassette still loads.

A missing cassette file loads as an empty cassette (`{ records: [], errors:
[] }`) rather than an error, since a session that hasn't recorded anything
yet is a normal starting state.

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
