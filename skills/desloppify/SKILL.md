---
name: desloppify
description: >
  Code quality scanner. Detects AI-introduced anti-patterns across many
  categories. Run the CLI, triage results, fix on isolated git worktrees.
  Trigger: desloppify, clean up code, remove slop, code quality, dead code.
---

# Desloppify

CLI detects. You triage and fix. Read the saved artifacts first, then use repo-local worktrees when you want isolated parallel fix agents.

## When to use

- User says "desloppify", "clean up code", "remove slop", "code quality"
- After AI-assisted development sprints
- Before a release or code review

## Step 0: Install + set up

```bash
desloppify install-skill                  # runs npx skills add FasalZein/desloppify
desloppify install-hooks                  # installs repo-local pre-commit / pre-push hooks
desloppify setup                          # prints the guided first-run setup
```

Then check what tooling is available and install what's missing:

```bash
desloppify check-tools [path]             # shows project-aware tool + pack recommendations
```

The CLI auto-detects your project type (TS, Python, Rust, Go) and recommends relevant tools. Install the recommended ones for best coverage:

**JS/TS projects:**
```bash
bun add -d knip madge                     # dead code + circular deps
bun add -d @biomejs/biome                 # fast linter (slop blocker)
bun add -d oxlint                         # blazing fast lint (pre-commit)
```

**Python projects:**
```bash
pip install ruff mypy vulture             # lint + types + dead code
```

**Rust projects:**
```bash
rustup component add clippy               # lint + anti-patterns
```

**Go projects:**
```bash
go install honnef.co/go/tools/cmd/staticcheck@latest
```

**Always recommended:**
```bash
brew install ast-grep                     # structural pattern matching
```

## Step 1: Scan

```bash
desloppify scan [path] --pack js-ts               # terminal report + saved local artifacts
desloppify scan [path] --pack python              # first non-JS pack for Python repos
# artifacts are written under .desloppify/reports/
desloppify scan [path] --json --pack js-ts        # normalized findings JSON
desloppify scan [path] --markdown --pack js-ts    # readable markdown report
desloppify scan [path] --wiki --project <project> --pack js-ts
                                                 # wiki-forge review JSON with project context
desloppify scan [path] --handoff --project <project> --slice <slice-id> --pack js-ts
                                                 # compact markdown handoff with slice context
desloppify scan [path] --category <id> --pack js-ts
desloppify score [path] --pack js-ts              # weighted quality grade
desloppify delta [base] [head] --json             # compare two saved reports as JSON
desloppify delta [base] [head] --category complexity --fail-on added,worsened
desloppify delta [base] [head] --path '**/routes/*.ts' --fail-on any
desloppify delta [base] [head] --severity high,critical --fail-on added,worsened
desloppify delta [base] [head] --markdown         # regressions-only markdown + saved latest.delta.md artifact
desloppify delta [base] [head] --comment --max-findings 8
                                                   # compact PR/CI comment + saved latest.delta.comment.md
desloppify delta [base] [head]                    # human delta with category + path hotspots
desloppify rules --pack python                    # inspect the python bundle directly
```

After a normal scan, read these in order:
1. `.desloppify/reports/latest.findings.json`
2. `.desloppify/reports/latest.report.md`
3. `.desloppify/reports/latest.wiki.json` or `.desloppify/reports/latest.handoff.md`

Pretty scan mode also shows the current score, grade, and concrete next actions in the terminal.

## Config overrides

`desloppify` now reads repo-local config from:
- `desloppify.config.json`
- `.desloppifyrc`
- `.desloppifyrc.json`

Supported today:
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

This is the first extensibility step toward reference-style config/plugin support.

## Step 2: Triage

For each category with issues, decide:
- **Fix** — delegate to a sub-agent on a worktree
- **Skip** — by design, not worth churn
- **Flag-only** — public API, dynamic access, serialization — never auto-fix

You handle judgment. Is this try-catch necessary? Is this duplication intentional? Is this comment helpful or AI narration?

Important current behavior:
- `worktrees` prints setup commands; it does not spawn fix agents for you
- `fix --safe` is the most reliable path today; broader fix tiers are still partial

## Step 3: Fix

If you want isolated parallel fix agents, prepare worktrees first:

```bash
desloppify worktrees [path]               # prints worktree setup commands
```

Then give each fix agent:
1. its worktree path
2. the saved report path or a `--json` scan slice for its category
3. `desloppify fix . --safe` first, then judgment fixes, then a re-scan

The current `worktrees` command prints the setup commands; your agent orchestrates the rest.

## Step 4: Verify

```bash
git checkout main
git merge fix/dead-code fix/weak-types fix/ai-slop ...
git worktree prune
desloppify scan [path]                    # confirm improvement
```

## Commands

| Command | What it does |
|---------|-------------|
| `desloppify install-skill` | Install the shipped skill via `npx skills add` |
| `desloppify setup` | Print first-run setup guidance |
| `desloppify install-hooks` | Install repo-local hooks |
| `desloppify scan [path] --pack js-ts` | Detect issues, terminal report |
| `desloppify scan [path] --pack python` | Python pack scan |
| `desloppify scan --json --pack js-ts` | Normalized findings JSON |
| `desloppify scan --markdown --pack js-ts` | Readable markdown report |
| `desloppify scan --wiki --project <project> --pack js-ts` | Wiki-forge review JSON |
| `desloppify scan --handoff --project <project> --slice <slice-id> --pack js-ts` | Compact markdown handoff |
| `desloppify scan --category <id> --pack js-ts` | Single category scan |
| `desloppify score [path] --pack js-ts` | Weighted quality score + grade |
| `desloppify delta [base] [head] --json` | Compare saved reports as JSON |
| `desloppify delta [base] [head] --category <id> --fail-on added,worsened` | Gate one category's regressions |
| `desloppify delta [base] [head] --path '<glob>' --fail-on any` | Gate one path scope's changes |
| `desloppify delta [base] [head] --severity high,critical --fail-on added,worsened` | Gate one severity slice's regressions |
| `desloppify delta [base] [head] --markdown` | Regressions-only markdown + saved artifact |
| `desloppify delta [base] [head] --comment --max-findings 8` | Compact PR/CI comment + saved artifact |
| `desloppify delta [base] [head]` | Human delta with category + path hotspots |
| `desloppify rules --pack python` | Python rule catalog |
| `desloppify.config.json` | Repo-local built-in rule overrides |
| `desloppify fix [path] --safe` | Tier 1: mechanical fixes only |
| `desloppify fix --confident` | Tier 1-2: + AST-validated |
| `desloppify fix --all` | Tier 1-3: + cross-file |
| `desloppify rules` | List all detection rules |
| `desloppify check-tools [path] --json` | Project-aware tool + pack recommendations |
| `desloppify worktrees [path]` | Print worktree setup commands |

## Safety tiers

- **T1** — Mechanical fixes (comment removal). Git checkpoint only.
- **T2** — AST-validated fixes (empty catch, type casts). AST re-parse.
- **T3** — Cross-file fixes (dead code, type consolidation). Type checker / build.
- **Flag-only** — Public API, dynamic access, serialization. Never auto-fixed.

## Suppression

```bash
console.log("intentional"); // desloppify:ignore CONSOLE_LOG
```

Project-level: `.desloppifyignore` (gitignore syntax).

## Saved reports

A normal `desloppify scan ...` run writes:

- `.desloppify/reports/latest.findings.json`
- `.desloppify/reports/latest.report.md`
- `.desloppify/reports/latest.wiki.json`
- `.desloppify/reports/latest.handoff.md`

Use those paths as the canonical handoff for follow-up agents.

## Guidance for GOD_FILE findings

Treat `GOD_FILE` as a real refactor signal, not a blind delete/split command.
Current behavior:
- files are grouped into role-aware cohorts
- thresholds are derived from peer files in the same cohort, with static floors as safety rails
- `GOD_FILE` only emits when a file is both very large for its cohort and has at least one extra complexity signal
- large files without extra complexity usually downgrade to `LARGE_FILE`

When handling a `GOD_FILE`, inspect why it tripped:
- too many imports
- mixed route + DB concerns
- barrel/export concentration
- too many HTTP methods in one route file
- too many `useState` calls
- generic bucket-file structure
