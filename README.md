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
# or, for Python / Rust repos:
bunx desloppify scan . --pack python
bunx desloppify scan . --pack rust
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

## Programmatic API

Desloppify now exposes a stable root import for Bun/TS consumers so you do not have to depend on internal source-path imports.

```ts
import { scanProject, scanProjectSummary, summarizeScanReport, calculateScore, compareScanReports } from "desloppify"

const report = await scanProject({ path: ".", pack: "js-ts" })
const summary = await scanProjectSummary({ path: ".", pack: "js-ts" })
```

Current root exports focus on the stable scan/report contract:
- `scanProject(...)`
- `scanProjectSummary(...)`
- `summarizeScanReport(report)`
- `calculateScore(...)`
- `compareScanReports(...)`

The full canonical findings artifact is still richer than the compact summary transport view.

Internal `desloppify/src/*` imports are not part of the supported package surface.

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

## Optional overhaul review mode

The shipped skill now also supports an **optional overhaul-review workflow** for users who want more than a quick scan/fix pass.

This is a **skill-layer mode**, not a new CLI command.

Use it when the user wants:
- a systematic repo audit
- a phased cleanup plan
- an architecture / tests / performance review tied back to real scan evidence

Mode choices:
- **Surgical** — one theme only
- **Systematic** — section-by-section review
- **Full audit** — broad phased roadmap

The workflow still starts from real desloppify evidence (`scan`, saved artifacts, `report`, `delta`) and ends with:
- impact/effort buckets
- explicit out-of-scope items
- likely failure modes
- ordered remediation steps

The detailed instructions live in `skills/desloppify/reference/overhaul-review.md`.

## Commands

```bash
desloppify setup                                # guided first-run setup
desloppify install-skill --print                # print the canonical skill install command
desloppify install-skill                        # run npx skills add FasalZein/desloppify
desloppify install-hooks --print                # print the hook scaffold + git config script
desloppify install-hooks                        # scaffold repo-local pre-commit / pre-push hooks and enable them
desloppify scan [path] --pack js-ts             # detect issues and save report artifacts locally
desloppify scan [path] --pack python            # first non-JS pack for Python repos
desloppify scan [path] --pack rust              # Rust pack (ast-grep proof pack)
desloppify scan [path] --json --pack js-ts      # machine-readable normalized findings output

desloppify scan [path] --json --summary --pack js-ts
                                              # compact machine-readable summary without full findings payload
desloppify scan [path] --markdown --pack js-ts  # readable markdown report
desloppify scan [path] --wiki --project <project> --pack js-ts
desloppify scan [path] --handoff --project <project> --slice <slice-id> --pack js-ts
desloppify scan [path] --category complexity --pack js-ts
desloppify scan [path] --architecture modular-monolith --pack js-ts
desloppify scan [path] --staged --pack js-ts    # staged git changes only
desloppify scan [path] --changed --pack js-ts   # current branch diff only
desloppify scan [path] --with-madge --pack js-ts
                                              # include whole-repo circular dependency analysis
desloppify report [path]                        # normalized metrics + path hotspots from latest saved scan
desloppify report [path] --json                 # emit the saved findings report JSON directly
desloppify report [path] --json --summary       # compact summary JSON from the saved report
desloppify benchmark fetch --manifest <file>    # clone/fetch pinned benchmark checkouts from a manifest
desloppify benchmark snapshot --manifest <file> # build benchmark snapshot JSON from a benchmark manifest
desloppify benchmark report --manifest <file>   # render markdown cohort report from that snapshot
desloppify score [path] --pack js-ts            # weighted quality grade (A+ to F)
desloppify score [path] --pack python           # weighted quality grade for Python scans
desloppify score [path] --pack rust             # weighted quality grade for Rust scans
desloppify score [path] --with-madge --pack js-ts
                                              # include circular dependency analysis in score runs
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
desloppify rules --pack rust                    # rust-specific rule bundle
desloppify rules --architecture modular-monolith # active architecture bundle only
desloppify fix [path] --safe                    # auto-fix safe mechanical issues
desloppify fix [path] --confident               # add AST-validated fixes
desloppify fix [path] --all                     # include cross-file fixes
desloppify check-tools [path] --json            # show available analyzers plus available/suggested packs as JSON
desloppify worktrees [path]                     # print worktree setup commands
```

Use `--project`, `--slice`, `--prd`, and `--feature` with `--wiki` or `--handoff` when you want wiki-native output with concrete project context.

## Git hooks for current changes by default

```bash
desloppify install-hooks
# or, if you want the raw command:
desloppify install-hooks --print
```

This scaffolds repo-local hooks under `.githooks/` and sets `git config core.hooksPath .githooks` for the current repo. The installed hooks resolve `desloppify` from `./node_modules/.bin`, `bunx`, or your PATH. Existing unmanaged hook files are left alone instead of being overwritten, and the installer refuses to replace another active hook chain from `.git/hooks`, `.husky`, or a worktree-specific hooks path.

- `pre-commit` → scans `--staged`
- `pre-push` → scans `--changed`

By default the hooks scan only current changes and block only on `HIGH`/`CRITICAL` findings.
They auto-pick the repo's suggested pack when that choice is unambiguous, otherwise they fall back to `js-ts`.
Set `DESLOPPIFY_PACK=<pack>` if you need a different pack in hook runs.
Set `DESLOPPIFY_HOOK_SCOPE=repo` if hook runs should scan the whole repo instead of the current diff.

## Saved report artifacts

A normal `desloppify scan ...` run writes artifacts to:

- `.desloppify/reports/latest.findings.json` (canonical scan JSON, now including normalized metrics + path hotspots)
- `.desloppify/reports/latest.report.md`
- `.desloppify/reports/latest.wiki.json`
- `.desloppify/reports/latest.handoff.md`
- `.desloppify/reports/latest.delta.md` (from `desloppify delta --markdown`)
- `.desloppify/reports/latest.delta.comment.md` (from `desloppify delta --comment`)

The CLI also prints these paths after the scan so agents and humans know exactly what to read next. The first artifact-writing scan also auto-adds `.desloppify/` to `.gitignore` in git repos so this working state stays local by default. Use `desloppify report .` when you want a compact normalized summary from the latest saved scan. Use `--json --summary` when a full findings payload would be too large for an agent or automation consumer. The same split now exists programmatically: `scanProject(...)` returns the full report, while `scanProjectSummary(...)` returns the compact view.

For cross-repo comparisons, use a benchmark manifest and run:

```bash
desloppify benchmark fetch --manifest ./benchmarks/manifest.json
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
    "checkoutsDir": "./checkouts",
    "snapshotPath": "./artifacts/benchmark.snapshot.json",
    "reportPath": "./artifacts/benchmark.report.md"
  },
  "repos": [
    {
      "id": "ai",
      "repo": "example/ai-repo",
      "url": "https://github.com/example/ai-repo.git",
      "ref": "<pinned-sha>",
      "cohort": "explicit-ai",
      "pack": "js-ts"
    },
    {
      "id": "oss",
      "repo": "example/oss-repo",
      "url": "https://github.com/example/oss-repo.git",
      "ref": "<pinned-sha>",
      "cohort": "mature-oss",
      "pack": "js-ts"
    }
  ],
  "pairings": [
    { "aiRepoId": "ai", "solidRepoId": "oss" }
  ]
}
```

If you already have local repos instead of pinned remotes, you can still use `path` entries and skip `benchmark fetch`.

## Scoring

Each issue deducts points based on severity and category weight. Security issues hit harder than AI slop. Per-category cap prevents one noisy category from tanking your score.

Grades: **A+** (95-100) **A** (85-94) **B** (70-84) **C** (50-69) **D** (30-49) **F** (0-29)

## Requirements

- [Bun](https://bun.sh) runtime
- [ast-grep](https://ast-grep.github.io) — structural pattern matching

Optional (auto-detected, improves coverage):
- `knip` — dead code detection (JS/TS)
- `madge` — circular dependency detection (JS/TS, opt-in for full scans via `--with-madge` or `--category circular-deps`)
- `tsc` — implicit any detection

## Packs

Desloppify is moving toward a language-agnostic core with explicit first-party packs.

| Pack | Status | Notes |
|------|--------|-------|
| `js-ts` | Available | JavaScript / TypeScript / React-oriented analyzer bundle |
| `python` | Available | First non-JS pack with python-scoped grep and ast-grep rules |
| `rust` | Available | Rust proof pack with rust-scoped ast-grep rules |

Run `desloppify check-tools .` before your first scan to see the available packs for the repo and the suggested pack when the choice is unambiguous.

More packs can be added without changing the core scan/report contract.

Current tool adapters include:
- JS/TS: `knip`, `madge`, `ast-grep`, `tsc`, `eslint`, `biome`, `oxlint`
- Python: `ast-grep`, `ruff`
- Rust: `ast-grep`, `cargo clippy`
- Go: built-in grep rules, `staticcheck`, `golangci-lint`
- Ruby: built-in grep rules, `rubocop`
- Recommendations only today: `oxfmt`, `mypy`, `vulture`

The external-tool layer is intentionally best-effort: if a tool or config is missing, `desloppify` skips it instead of failing the whole scan. Repo-local binaries in `node_modules/.bin` are resolved automatically when you scan or run fixes against another checkout.

For large JS/TS repos, circular dependency analysis is intentionally opt-in. Full scans skip `madge` unless you pass `--with-madge`, and `--category circular-deps` still runs only the circular-deps pass. On monorepos with `package.json` workspaces like `apps/*` and `packages/*`, the madge pass is scoped per workspace package instead of one repo-wide graph.

## Configuration

`desloppify` now supports repo-local config discovery:

- `desloppify.config.json`
- `desloppify.config.cjs`
- `desloppify.config.js`
- `.desloppifyrc`
- `.desloppifyrc.json`
- `.desloppifyrc.cjs`
- `.desloppifyrc.js`

Current support is intentionally small and deterministic:
- `extends`
- `plugins.<namespace>` for local JSON/module rule packs or installed package plugins
- `plugin:<namespace>/<config>` preset extends
- `rules.<id>.enabled`
- `rules.<id>.severity`
- `rules.<id>.weight`
- `rules.<id>.options.<name>` for plugin rule option values
- `overrides[].files`
- `overrides[].rules.<id>.enabled`
- `overrides[].rules.<id>.severity`
- `overrides[].rules.<id>.weight`
- `overrides[].rules.<id>.options.<name>`

Example:

```json
{
  "extends": ["./desloppify.base.json"],
  "plugins": {
    "local": "./desloppify.plugin.cjs"
  },
  "rules": {
    "CONSOLE_LOG": { "enabled": false },
    "LONG_FILE": { "severity": "HIGH", "weight": 1.5 },
    "local/contains-token": {
      "options": {
        "token": "ACME",
        "replacement": "safeToken"
      }
    }
  },
  "overrides": [
    {
      "files": ["src/rules/**"],
      "rules": {
        "LONG_FILE": { "enabled": false },
        "local/contains-token": {
          "options": {
            "token": "RULE_TEST_TOKEN"
          }
        }
      }
    }
  ]
}
```

A plugin can be a local JSON file, a local module, or an installed package. Module plugins should use the public helper from `desloppify/plugin-api` and declare metadata.

`desloppify.config.js` / `.cjs` and `.desloppifyrc.js` / `.cjs` are also supported when you want computed config.

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
      id: "contains-token",
      category: "ai-slop",
      severity: "MEDIUM",
      message: "Contains {{token}}",
      description: "Contains {{token}} marker",
      fix: "Replace {{token}} with {{replacement}}",
      pattern: "{{token}}",
      files: ["src/**"],
      identityGroup: 0,
      options: {
        token: {
          type: "string",
          default: "ACME",
          description: "Token literal to flag"
        },
        replacement: {
          type: "string",
          default: "safeToken"
        }
      }
    }
  ],
  configs: {
    recommended: {
      rules: {
        "local/contains-token": {
          weight: 1.5,
          options: {
            token: "BETA"
          }
        }
      }
    }
  }
})
```

Packaged plugins work too:

```json
{
  "plugins": { "acme": "desloppify-plugin-acme" },
  "extends": ["plugin:acme/recommended"]
}
```

Then reference a preset with:

```json
{
  "plugins": { "local": "./desloppify.plugin.cjs" },
  "extends": ["plugin:local/recommended"]
}
```

Module plugin validation now checks `apiVersion`, namespace mismatches, duplicate/non-local rule ids, and option default type mismatches. Plugin rule options are scalar values (`string`, `number`, `boolean`) resolved from rule defaults, then top-level config, then matching file overrides. `{{optionName}}` placeholders can be used in plugin `pattern`, `flags`, `message`, `description`, `fix`, and `files`. Plugin regex rules also derive stable delta identities from their match text (or a selected `identityGroup` capture), and can now attach fix text just like built-in findings, so line shifts do not churn delta reports and custom rules surface better remediation. This keeps local plugins deterministic and gives better failure messages during scan/rules/score.

This lets you tune built-in rules without forking the tool. It is the first step toward reference-repo-style config/plugin extensibility.

`.desloppify/` is intentionally local working state, not a committed artifact surface. If you need committed outputs, export them explicitly instead of tracking the hidden working directory.

`desloppify fix` also uses repo-local formatter tooling as a cleanup pass after safe rewrites:
- JS/TS: `biome format`, `oxfmt`
- Python: `ruff format`

## Release

- CI pins Bun to `1.3.10` for reproducible test runs
- `bun run release:check` verifies the npm tarball payload locally
- GitHub Actions `Release` workflow bumps `patch` / `minor` / `major`, syncs versioned source files, commits, and tags `vX.Y.Z`
- GitHub Actions `Publish` workflow publishes the tagged release to npm and creates a GitHub release

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
