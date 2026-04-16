---
name: desloppify
description: >
  Agent-agnostic code cleanup. CLI detects 116+ rules across 16 categories.
  Agent triages, spawns fix sub-agents on git worktrees, merges results.
  Use when: desloppify, clean up code, remove slop, code quality audit,
  deep refactor, remove AI slop, remove dead code, fix types.
---

# Desloppify

CLI detects. You triage and fix. Every fix agent runs on its own git worktree.

## When to invoke

- "desloppify", "clean up code", "remove slop", "code quality", "remove dead code"
- After AI-assisted development sprints
- Before a release or periodic hygiene

## Workflow

```
1. Scan    → desloppify scan [path]
2. File    → wiki research file (if /wiki available)
3. Triage  → review JSON, decide Fix / Skip / Flag per category
4. Fix     → one sub-agent per Fix category, each on a git worktree
5. Merge   → merge worktree branches, run tests, re-scan
6. Close   → wiki closeout (if /wiki available)
```

### Phase 1: Scan

```bash
desloppify check-tools                    # what's available
desloppify scan [path]                    # full JSON report
desloppify scan [path] --markdown         # human-readable
desloppify scan [path] --category <id>    # single category
```

The CLI auto-detects language. For non-JS/TS projects with few findings, supplement:
- **Python:** `ruff check .`, `mypy .`, `vulture .`
- **Rust:** `cargo clippy -- -W clippy::all`
- **Go:** `staticcheck ./...`

### Phase 2: File audit

If `/wiki` is available: `wiki research file <project> "desloppify-audit-$(date +%Y-%m-%d)"`

### Phase 3: Triage

For each category with issues, decide:
- **Fix** — delegate to a sub-agent on a worktree
- **Skip** — by design or not worth churn
- **Flag-only** — public API, dynamic access, serialization — never auto-fix

The CLI handles detection. You handle judgment: Is this try-catch necessary? Is this duplication intentional? Is this comment helpful or LLM narration?

### Phase 4: Fix sub-agents

**Hard rule: no worktree = no agent.**

```bash
# Create worktrees for each Fix category
desloppify worktrees [path]               # prints git worktree add commands

# Verify each worktree exists before spawning its agent
# If creation fails, skip that category — do not run without a worktree
```

Each sub-agent receives:
1. Its worktree path
2. The scan JSON slice for its category only
3. Instructions: `desloppify fix . --safe` first, then judgment fixes, then re-scan to verify

Use your harness's native sub-agent mechanism. Run all in parallel.

### Phase 5: Merge + verify

```bash
git checkout main
git merge fix/dead-code fix/weak-types fix/ai-slop ...
git worktree prune
desloppify scan [path]                    # verify score improved
# run existing test suite if available
```

### Phase 6: Wiki closeout

If `/wiki` is available: `wiki checkpoint` → `wiki maintain` → `wiki closeout` → `wiki gate`

## CLI reference

| Command | Purpose |
|---------|---------|
| `desloppify scan [path]` | Detect issues → JSON |
| `desloppify scan --markdown` | Human-readable report |
| `desloppify fix [path] --safe` | Tier 1: mechanical fixes only |
| `desloppify fix --confident` | Tier 1-2: + AST-validated |
| `desloppify fix --all` | Tier 1-3: + cross-file |
| `desloppify rules` | List all 116+ detection rules |
| `desloppify score [path]` | Weighted quality score + grade |
| `desloppify rules --category <id>` | Filter by category |
| `desloppify check-tools` | Show available analyzers |
| `desloppify worktrees [path]` | Print worktree setup commands |

Safety tiers: T1 = git checkpoint only, T2 = AST validation, T3 = type checker/build, flag-only = never auto-fixed.

## False positive handling

```bash
# Suppress a rule for a specific file
# desloppify:ignore RULE_ID
console.log("intentional debug output"); // desloppify:ignore CONSOLE_LOG

# Project-level ignores in .desloppifyignore
dist/
coverage/
*.gen.ts
*.min.js
```

The CLI respects `.desloppifyignore` (gitignore syntax) and inline `desloppify:ignore` comments.
