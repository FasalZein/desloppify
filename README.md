# Desloppify

Your AI wrote spaghetti. This eats it.

Desloppify finds the mess that AI coding agents leave behind — banner comments nobody asked for, placeholder variables named `data2`, empty catch blocks, god files with 1200 lines, `forEach(async ...)` that silently drops promises, and the classic placeholder TODO that shipped to prod.

The CLI scans. Your agent (or you) decides what to fix. Fixes run on isolated git worktrees so nothing breaks.

## Quick start

```bash
# 1) Install the agent skill
npx skills add FasalZein/desloppify

# 2) Install repo-local hooks
bunx desloppify install-hooks

# 3) Print the guided first-run setup
bunx desloppify setup

# 4) Run the scanner
bunx desloppify scan . --pack js-ts
bunx desloppify report .
bunx desloppify score . --pack js-ts
# or, for Python repos:
bunx desloppify scan . --pack python
```

## Install as a skill

Desloppify is skill-driven. Install it as an agent skill and say "desloppify" or "clean up this code" — your agent handles the rest.

```bash
# Print the canonical install command
bunx desloppify install-skill --print

# Run the install directly from the CLI
bunx desloppify install-skill
```

The canonical underlying command is:

```bash
npx skills add FasalZein/desloppify
```

The skill teaches your agent the full workflow: scan, triage, read saved artifacts, prepare isolated fix worktrees when needed, merge, and verify. You don't need to memorize commands — the skill drives everything.

### Other install methods

```bash
# Global CLI install
bun install -g desloppify

# Clone and link
git clone https://github.com/FasalZein/desloppify.git
cd desloppify && bun install && bun link
```

## What it catches

Desloppify scans for anti-patterns across categories like:

- **AI Slop** — banner comments, narration, hedging, placeholder data, `console.log("here")`
- **Complexity** — god files, barrel exports, mixed concerns, deep nesting, monolith routes
- **Security** — hardcoded secrets, SQL injection, eval/exec, pickle loads
- **Test Quality** — empty tests, weak assertions, sleepy tests, skipped tests
- **Async Correctness** — `forEach(async)`, blocking requests, sequential independent awaits
- **Dead Code** — unused exports, functions, files, dependencies
- **Weak Types** — `any`, `as any`, `object`, `Function`, `@ts-ignore`
- **Runtime Validation** — unvalidated `req.body`, `JSON.parse` casts, fetch response casts
- **Accessibility** — interactive divs, missing alt text, inputs without labels
- **Naming & Semantics** — numeric suffixes, generic bucket files, Python builtin shadowing

...and more. Run `desloppify rules` to see the full list.

## How it works

```
You (or your agent) says "desloppify"
  ↓
Skill takes over
  ↓
CLI scans → finds issues → scores codebase
  ↓
Agent triages: fix / skip / flag
  ↓
You can prepare git worktrees and spawn fix agents in parallel
  ↓
Merge → re-scan → confirm score improved
```

The CLI handles detection deterministically. The agent handles judgment — is this try-catch necessary? Is this duplication intentional? Is this comment helpful or AI narration?

The current `worktrees` command prints the setup commands; your agent or shell orchestrates the actual fix runs.

## Commands

```bash
desloppify setup                                # guided first-run setup
desloppify install-skill --print                # print the canonical skill install command
desloppify install-skill                        # run npx skills add FasalZein/desloppify
desloppify install-hooks --print                # print the canonical git hook install command
desloppify install-hooks                        # install repo-local pre-commit / pre-push hooks
desloppify scan [path] --pack js-ts             # detect issues and save report artifacts locally
desloppify scan [path] --pack python            # first non-JS pack for Python repos
desloppify scan [path] --json --pack js-ts      # machine-readable normalized findings output
desloppify scan [path] --markdown --pack js-ts  # readable markdown report
desloppify scan [path] --wiki --project <project> --pack js-ts
desloppify scan [path] --handoff --project <project> --slice <slice-id> --pack js-ts
desloppify scan [path] --category complexity --pack js-ts
desloppify scan [path] --architecture modular-monolith --pack js-ts
desloppify scan [path] --staged --pack js-ts    # staged git changes only
desloppify scan [path] --changed --pack js-ts   # current branch diff only
desloppify report [path]                        # normalized metrics + path hotspots from latest saved scan
desloppify report [path] --json                 # emit the saved findings report JSON directly
desloppify benchmark snapshot --manifest <file> # build benchmark snapshot JSON from a local cohort manifest
desloppify benchmark report --manifest <file>   # render markdown cohort report from that snapshot
desloppify score [path] --pack js-ts            # weighted quality grade (A+ to F)
desloppify score [path] --pack python           # weighted quality grade for Python scans
desloppify delta [base] [head] --json           # compare saved findings reports across two repos or report paths
desloppify delta [base] [head] --category complexity --fail-on added,worsened
desloppify delta [base] [head] --path '**/routes/*.ts' --fail-on any
desloppify delta [base] [head] --severity high,critical --fail-on added,worsened
desloppify delta [base] [head] --markdown       # regressions-only markdown + saved latest.delta.md artifact
desloppify delta [base] [head] --comment --max-findings 8
                                              # compact PR/CI comment + saved latest.delta.comment.md
desloppify delta [base] [head]                  # human delta with category + path hotspots
desloppify rules                                # list all detection rules after config overrides
desloppify score [path]                         # score also respects desloppify.config.json
desloppify rules --pack python                  # python-specific rule bundle
desloppify rules --architecture modular-monolith # active architecture bundle only
desloppify fix [path] --safe                    # auto-fix safe mechanical issues
desloppify fix [path] --confident               # add AST-validated fixes
desloppify fix [path] --all                     # include cross-file fixes
desloppify check-tools [path] --json            # show available analyzers plus available/suggested packs as JSON
desloppify worktrees [path]                     # print worktree setup commands
```

Use `--project`, `--slice`, `--prd`, and `--feature` with `--wiki` or `--handoff` when you want wiki-native output with concrete project context.

## Git hooks for changed files only

```bash
desloppify install-hooks
# or, if you want the raw command:
desloppify install-hooks --print
```

This installs repo-local hooks via `.githooks/`:

- `pre-commit` → scans `--staged`
- `pre-push` → scans `--changed`

Both hooks scan only the diff on your branch, not the whole repo, and block only on `HIGH`/`CRITICAL` findings.
Set `DESLOPPIFY_PACK=<pack>` if you need a different pack in hook runs.

## Saved report artifacts

A normal `desloppify scan ...` run writes artifacts to:

- `.desloppify/reports/latest.findings.json` (canonical scan JSON, now including normalized metrics + path hotspots)
- `.desloppify/reports/latest.report.md`
- `.desloppify/reports/latest.wiki.json`
- `.desloppify/reports/latest.handoff.md`
- `.desloppify/reports/latest.delta.md` (from `desloppify delta --markdown`)
- `.desloppify/reports/latest.delta.comment.md` (from `desloppify delta --comment`)

The CLI also prints these paths after the scan so agents and humans know exactly what to read next. Use `desloppify report .` when you want a compact normalized summary from the latest saved scan.

For cross-repo comparisons, use a benchmark manifest and run:

```bash
desloppify benchmark snapshot --manifest ./benchmarks/manifest.json
desloppify benchmark report --manifest ./benchmarks/manifest.json
```

Pretty scan mode also shows:
- the current score / grade
- issue severity summary
- concrete next actions

Recommended follow-up order:
1. `latest.findings.json` for machine decisions
2. `latest.report.md` for human review
3. `latest.wiki.json` or `latest.handoff.md` for workflow handoff

Example benchmark manifest:

```json
{
  "schemaVersion": 1,
  "id": "local-cohort",
  "name": "Local cohort",
  "description": "Compare one explicit-AI repo against one mature OSS repo.",
  "artifacts": {
    "snapshotPath": "./artifacts/benchmark.snapshot.json",
    "reportPath": "./artifacts/benchmark.report.md"
  },
  "repos": [
    { "id": "ai", "path": "../repos/ai-repo", "cohort": "explicit-ai", "pack": "js-ts" },
    { "id": "oss", "path": "../repos/oss-repo", "cohort": "mature-oss", "pack": "js-ts" }
  ],
  "pairings": [
    { "aiRepoId": "ai", "solidRepoId": "oss" }
  ]
}
```

## Scoring

Each issue deducts points based on severity and category weight. Security issues hit harder than AI slop. Per-category cap prevents one noisy category from tanking your score.

Grades: **A+** (95-100) **A** (85-94) **B** (70-84) **C** (50-69) **D** (30-49) **F** (0-29)

## Requirements

- [Bun](https://bun.sh) runtime
- [ast-grep](https://ast-grep.github.io) — structural pattern matching

Optional (auto-detected, improves coverage):
- `knip` — dead code detection (JS/TS)
- `madge` — circular dependency detection (JS/TS)
- `tsc` — implicit any detection

## Packs

Desloppify is moving toward a language-agnostic core with explicit first-party packs.

| Pack | Status | Notes |
|------|--------|-------|
| `js-ts` | Available | JavaScript / TypeScript / React-oriented analyzer bundle |
| `python` | Available | First non-JS pack with python-scoped grep and ast-grep rules |

Run `desloppify check-tools .` before your first scan to see the available packs for the repo and the suggested pack when the choice is unambiguous.

More packs can be added without changing the core scan/report contract.

## Configuration

`desloppify` now supports repo-local config discovery:

- `desloppify.config.json`
- `.desloppifyrc`
- `.desloppifyrc.json`

Current support is intentionally small and deterministic:
- `extends`
- `plugins.<namespace>` for local JSON or module rule packs
- `plugin:<namespace>/<config>` preset extends
- `rules.<id>.enabled`
- `rules.<id>.severity`
- `rules.<id>.weight`
- `overrides[].files`
- `overrides[].rules.<id>.enabled`
- `overrides[].rules.<id>.severity`
- `overrides[].rules.<id>.weight`

Example:

```json
{
  "extends": ["./desloppify.base.json"],
  "plugins": {
    "local": "./desloppify.plugin.cjs"
  },
  "rules": {
    "CONSOLE_LOG": { "enabled": false },
    "LONG_FILE": { "severity": "HIGH", "weight": 1.5 }
  },
  "overrides": [
    {
      "files": ["src/rules/**"],
      "rules": {
        "LONG_FILE": { "enabled": false }
      }
    }
  ]
}
```

A local plugin file can be JSON or a local module. Module plugins should use the public helper from `desloppify/plugin-api` and declare metadata.

```js
const { definePlugin, PLUGIN_API_VERSION } = require("desloppify/plugin-api")

module.exports = definePlugin({
  meta: {
    name: "local-plugin",
    namespace: "local",
    apiVersion: PLUGIN_API_VERSION
  },
  rules: [
    {
      id: "contains-acme",
      category: "ai-slop",
      severity: "MEDIUM",
      message: "Contains ACME",
      description: "Contains ACME marker",
      pattern: "ACME",
      files: ["src/**"]
    }
  ],
  configs: {
    recommended: {
      rules: {
        "local/contains-acme": { weight: 1.5 }
      }
    }
  }
})
```

Then reference a preset with:

```json
{
  "plugins": { "local": "./desloppify.plugin.cjs" },
  "extends": ["plugin:local/recommended"]
}
```

Module plugin validation now checks `apiVersion`, namespace mismatches, and duplicate/non-local rule ids. This keeps local plugins deterministic and gives better failure messages during scan/rules/score.

This lets you tune built-in rules without forking the tool. It is the first step toward reference-repo-style config/plugin extensibility.

## False positives

```bash
# Inline: suppress a specific rule
console.log("intentional"); // desloppify:ignore CONSOLE_LOG

# Project-level: .desloppifyignore (gitignore syntax)
dist/
coverage/
*.gen.ts
```

## License

MIT
