# Commands reference

## Setup

```bash
desloppify install-skill
desloppify install-hooks
desloppify setup
desloppify check-tools [path]
```

`desloppify install-hooks` scaffolds `.githooks/` into the current git repo, enables `core.hooksPath`, and installs hooks that resolve the CLI from the repo, `bunx`, or PATH. The hooks auto-pick the repo's suggested pack when that choice is clear, otherwise fall back to `js-ts`. The installer refuses to overwrite unmanaged hook files or replace another hook manager's `core.hooksPath`. Hook scans default to current changes. Set `DESLOPPIFY_HOOK_SCOPE=repo` to make the installed hooks scan the whole repo instead.

## Scan + reports

```bash
desloppify scan [path] --pack js-ts
desloppify scan [path] --pack python
desloppify scan [path] --pack rust
desloppify scan [path] --pack go
desloppify scan [path] --pack ruby
desloppify scan [path] --json --pack js-ts
desloppify scan [path] --json --summary --pack js-ts
desloppify scan [path] --markdown --pack js-ts
desloppify scan [path] --wiki --project <project> --pack js-ts
desloppify scan [path] --handoff --project <project> --slice <slice-id> --pack js-ts
desloppify scan [path] --category <id> --pack js-ts
desloppify scan [path] --architecture modular-monolith --pack js-ts
desloppify scan [path] --staged --pack js-ts
desloppify scan [path] --changed --pack js-ts
desloppify scan [path] --with-madge --pack js-ts
desloppify report [path]
desloppify report [path] --json
desloppify report [path] --json --summary
desloppify score [path] --pack js-ts
desloppify score [path] --with-madge --pack js-ts
```

## Benchmarks + deltas

```bash
desloppify benchmark fetch --manifest <file>
desloppify benchmark snapshot --manifest <file>
desloppify benchmark report --manifest <file>
desloppify delta [base] [head]
desloppify delta [base] [head] --json
desloppify delta [base] [head] --markdown
desloppify delta [base] [head] --comment --max-findings 8
desloppify delta [base] [head] --category complexity --fail-on added,worsened
desloppify delta [base] [head] --path '**/routes/*.ts' --fail-on any
desloppify delta [base] [head] --severity high,critical --fail-on added,worsened
```

## Rules + fixing

```bash
desloppify rules
desloppify rules --pack python
desloppify rules --pack rust
desloppify rules --architecture modular-monolith
desloppify fix [path] --safe
desloppify fix [path] --confident
desloppify fix [path] --all
desloppify worktrees [path]
```

## Saved artifacts

A normal scan writes:

- `.desloppify/reports/latest.findings.json`
- `.desloppify/reports/latest.report.md`
- `.desloppify/reports/latest.wiki.json`
- `.desloppify/reports/latest.handoff.md`
- `.desloppify/reports/latest.delta.md`
- `.desloppify/reports/latest.delta.comment.md`

The first artifact-writing scan also auto-adds `.desloppify/` to `.gitignore` in git repos so this state stays local by default.

Read in this order:
1. `latest.findings.json`
2. `desloppify report .`
3. `latest.report.md`
4. `latest.wiki.json` or `latest.handoff.md`

Use `--json --summary` when you need a compact machine-readable payload without the full findings array on stdout.
