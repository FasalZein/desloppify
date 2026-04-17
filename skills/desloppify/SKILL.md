---
name: desloppify
description: >
  Code quality scanner. Detects AI-introduced anti-patterns across many
  categories. Run the CLI, triage results, fix on isolated git worktrees.
  Trigger: desloppify, clean up code, remove slop, code quality, dead code.
---

# Desloppify

CLI detects. You triage and fix. Use repo-local worktrees when you want isolated parallel fix agents.

## When to use

- User says "desloppify", "clean up code", "remove slop", "code quality"
- After AI-assisted development sprints
- Before a release or code review

## Step 0: Install + set up

```bash
desloppify install-skill                  # runs npx skills add FasalZein/desloppify
desloppify setup                          # prints the guided first-run setup
```

Then check what tooling is available and install what's missing:

```bash
desloppify check-tools [path]             # shows project-aware recommendations
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
# artifacts are written under .desloppify/reports/
desloppify scan [path] --json --pack js-ts        # normalized findings JSON
desloppify scan [path] --markdown --pack js-ts    # readable markdown report
desloppify scan [path] --wiki --project <project> --pack js-ts
                                                 # wiki-forge review JSON with project context
desloppify scan [path] --handoff --project <project> --slice <slice> --pack js-ts
                                                 # compact markdown handoff with slice context
desloppify scan [path] --category <id> --pack js-ts
desloppify score [path] --pack js-ts              # weighted quality grade
```

## Step 2: Triage

For each category with issues, decide:
- **Fix** — delegate to a sub-agent on a worktree
- **Skip** — by design, not worth churn
- **Flag-only** — public API, dynamic access, serialization — never auto-fix

You handle judgment. Is this try-catch necessary? Is this duplication intentional? Is this comment helpful or AI narration?

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
| `desloppify scan [path] --pack js-ts` | Detect issues, terminal report |
| `desloppify scan --json --pack js-ts` | Normalized findings JSON |
| `desloppify scan --markdown --pack js-ts` | Readable markdown report |
| `desloppify scan --wiki --project <project> --pack js-ts` | Wiki-forge review JSON |
| `desloppify scan --handoff --project <project> --slice <slice> --pack js-ts` | Compact markdown handoff |
| `desloppify scan --category <id> --pack js-ts` | Single category scan |
| `desloppify score [path] --pack js-ts` | Weighted quality score + grade |
| `desloppify fix [path] --safe` | Tier 1: mechanical fixes only |
| `desloppify fix --confident` | Tier 1-2: + AST-validated |
| `desloppify fix --all` | Tier 1-3: + cross-file |
| `desloppify rules` | List all detection rules |
| `desloppify check-tools [path] --json` | Project-aware tool recommendations |
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
