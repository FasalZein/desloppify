---
name: desloppify
description: >
  Code quality scanner. Detects AI-introduced anti-patterns across many
  categories. Run the CLI, triage results, fix on isolated git worktrees.
  Trigger: desloppify, clean up code, remove slop, code quality, dead code.
---

# Desloppify

CLI detects. You triage and fix. Every fix runs on its own git worktree.

## When to use

- User says "desloppify", "clean up code", "remove slop", "code quality"
- After AI-assisted development sprints
- Before a release or code review

## Step 0: Set up tools

Before scanning, check what's available and install what's missing:

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
desloppify scan [path] --wiki --pack js-ts        # wiki-forge review JSON
desloppify scan [path] --handoff --pack js-ts     # compact markdown handoff
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

**No worktree = no fix agent.** Every fix sub-agent runs isolated.

```bash
desloppify worktrees [path]               # prints worktree setup commands
```

Each sub-agent gets:
1. Its worktree path
2. The `--json` scan slice for its category
3. Run `desloppify fix . --safe` first, then judgment fixes, then re-scan

Run all fix agents in parallel using your native sub-agent mechanism.

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
| `desloppify scan [path] --pack js-ts` | Detect issues, terminal report |
| `desloppify scan --json --pack js-ts` | Normalized findings JSON |
| `desloppify scan --wiki --pack js-ts` | Wiki-forge review JSON |
| `desloppify scan --handoff --pack js-ts` | Compact markdown handoff |
| `desloppify scan --category <id> --pack js-ts` | Single category scan |
| `desloppify score [path] --pack js-ts` | Weighted quality score + grade |
| `desloppify fix [path] --safe` | Tier 1: mechanical fixes only |
| `desloppify fix --confident` | Tier 1-2: + AST-validated |
| `desloppify fix --all` | Tier 1-3: + cross-file |
| `desloppify rules` | List all detection rules |
| `desloppify check-tools [path]` | Project-aware tool recommendations |
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
