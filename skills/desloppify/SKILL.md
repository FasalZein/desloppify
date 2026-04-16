---
name: desloppify
description: >
  Code quality scanner. 116+ rules across 16 categories detect AI-introduced
  anti-patterns. Run the CLI, triage results, fix on isolated git worktrees.
  Trigger: desloppify, clean up code, remove slop, code quality, dead code.
---

# Desloppify

CLI detects. You triage and fix. Every fix runs on its own git worktree.

## When to use

- User says "desloppify", "clean up code", "remove slop", "code quality"
- After AI-assisted development sprints
- Before a release or code review

## Workflow

```
1. Scan       → run CLI, review output
2. Triage     → decide Fix / Skip / Flag per category
3. Fix        → one sub-agent per category, each on a git worktree
4. Verify     → re-scan, confirm score improved
```

### Step 1: Scan

```bash
desloppify scan [path]                    # terminal report
desloppify scan [path] --json             # machine-readable
desloppify scan [path] --category <id>    # single category
desloppify score [path]                   # weighted quality grade
desloppify check-tools                    # available analyzers
```

For non-JS/TS projects, supplement with native tools:
- Python: `ruff check .`, `mypy .`, `vulture .`
- Rust: `cargo clippy -- -W clippy::all`
- Go: `staticcheck ./...`

### Step 2: Triage

For each category with issues, decide:
- **Fix** — delegate to a sub-agent on a worktree
- **Skip** — by design, not worth churn
- **Flag-only** — public API, dynamic access, serialization — never auto-fix

You handle judgment. Is this try-catch necessary? Is this duplication intentional? Is this comment helpful or AI narration?

### Step 3: Fix

**No worktree = no fix agent.** Every fix sub-agent runs isolated.

```bash
desloppify worktrees [path]               # prints worktree setup commands
```

Each sub-agent gets:
1. Its worktree path
2. The `--json` scan slice for its category
3. Run `desloppify fix . --safe` first, then judgment fixes, then re-scan

Run all fix agents in parallel using your native sub-agent mechanism.

### Step 4: Verify

```bash
git checkout main
git merge fix/dead-code fix/weak-types fix/ai-slop ...
git worktree prune
desloppify scan [path]                    # confirm improvement
```

## Commands

| Command | What it does |
|---------|-------------|
| `desloppify scan [path]` | Detect issues, terminal report |
| `desloppify scan --json` | Machine-readable JSON output |
| `desloppify scan --category <id>` | Single category scan |
| `desloppify score [path]` | Weighted quality score + grade |
| `desloppify fix [path] --safe` | Tier 1: mechanical fixes only |
| `desloppify fix --confident` | Tier 1-2: + AST-validated |
| `desloppify fix --all` | Tier 1-3: + cross-file |
| `desloppify rules` | List all 116+ detection rules |
| `desloppify check-tools` | Show available analyzers |
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
