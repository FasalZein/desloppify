# Desloppify

Agent-agnostic code cleanup. Catches 73+ anti-patterns across 11 categories that AI coding agents introduce into codebases — security slop, defensive try-catch, weak types, dead code, AI narration comments, circular deps, and more.

CLI does deterministic detection. Your agent handles triage and judgment fixes. Each fix category runs on its own git worktree for safe parallel execution.

## Install

```bash
# Install the skill (works with any agent that reads SKILL.md)
npx skills add FasalZein/desloppify

# Install the CLI (requires Bun)
cd ~/.claude/skills/desloppify && bun install && bun link
```

After restarting your session, the `/desloppify` command is available.

### Manual Install

```bash
# Clone into your skills directory
git clone https://github.com/FasalZein/desloppify.git ~/.claude/skills/desloppify

# Install CLI dependencies and link globally
cd ~/.claude/skills/desloppify && bun install && bun link
```

## Requirements

- [Bun](https://bun.sh) runtime
- [ast-grep](https://ast-grep.github.io) (`sg`) — structural pattern matching (34 languages)

Optional (auto-detected, improves coverage):
- `knip` — dead code detection (JS/TS)
- `madge` — circular dependency detection (JS/TS)
- `tsc` — TypeScript implicit any detection
- `ruff` / `mypy` / `vulture` — Python analysis
- `cargo clippy` — Rust analysis
- `staticcheck` — Go analysis

## Usage

```bash
# Check what tools are available
desloppify check-tools

# Scan a project
desloppify scan .
desloppify scan . --markdown
desloppify scan . --category ai-slop

# Auto-fix safe issues (tier 1 only)
desloppify fix . --safe

# Get a weighted quality score
desloppify score .
desloppify score . --json

# List all detection rules
desloppify rules
desloppify rules --category weak-types
```

Or invoke via your agent: just say "desloppify" or "clean up code" and the skill takes over.

## Categories

| Category | What it catches |
|----------|----------------|
| `dead-code` | Unused exports, functions, files, dependencies |
| `weak-types` | `any`, `as any`, `object`, `Function`, `@ts-ignore` |
| `ai-slop` | Banner comments, narration, hedging, console.log, placeholder data |
| `circular-deps` | Import cycles between modules |
| `duplication` | Near-identical functions, repeated string literals |
| `defensive-programming` | Empty catch, catch-log-continue, deep optional chains |
| `legacy-code` | `@deprecated`, TODO/FIXME, dead feature flags |
| `type-fragmentation` | Duplicate types, complex inline types |
| `inconsistency` | Mixed naming, mixed exports, unlisted deps |
| `complexity` | Long functions, deep nesting, many params, nested ternaries |
| `security-slop` | Hardcoded secrets, SQL injection, hardcoded URLs |

## Scoring System

```
╔════════════════════════════╗
║  DESLOPPIFY SCORE:  73     ║
║  GRADE: B                   ║
╚════════════════════════════╝
```

Each issue deducts points based on severity (CRITICAL=5, HIGH=3, MEDIUM=1, LOW=0.5) multiplied by category weight (security-slop=2x, weak-types/defensive/circular-deps=1.5x, ai-slop/legacy/inconsistency=0.5x). Per-category penalty capped at 20 points to prevent one category from dominating.

**Grades:** A+(95-100) A(85-94) B(70-84) C(50-69) D(30-49) F(0-29)

## How It Works

```
1. Scan    → desloppify scan [path]           # deterministic detection
2. Score   → desloppify score [path]          # weighted quality grade
3. Triage  → agent reviews JSON output        # judgment: fix / skip / flag
4. Fix     → one sub-agent per category       # each on its own git worktree
5. Merge   → merge worktree branches          # re-scan to verify improvement
```

**Hard rule: no worktree = no agent.** Every fix sub-agent runs on an isolated git worktree. If worktree creation fails, that category is skipped — never run without isolation.

## Safety Tiers

| Tier | What | Validation |
|------|------|------------|
| T1 | Mechanical fixes (comment removal, slop cleanup) | Git checkpoint only |
| T2 | AST-validated fixes (empty catch, type casts) | AST re-parse |
| T3 | Cross-file fixes (dead code, type consolidation) | Type checker / build |
| Flag-only | Public API, dynamic access, serialization | Never auto-fixed |

## False Positives

```bash
# Inline suppression
console.log("intentional"); // desloppify:ignore CONSOLE_LOG

# Project-level ignores (.desloppifyignore, gitignore syntax)
dist/
coverage/
*.gen.ts
*.min.js
```

## File Structure

```
desloppify/
├── skills/
│   └── desloppify/
│       └── SKILL.md              # Agent-facing skill protocol
├── src/
│   ├── cli.ts                    # CLI entry point (citty)
│   ├── types.ts                  # Core types
│   ├── tools.ts                  # Tool detection
│   ├── commands/
│   │   ├── scan.ts               # Scan orchestrator
│   │   ├── score.ts              # Weighted scoring system
│   │   ├── fix.ts                # Auto-fix engine
│   │   ├── rules.ts              # Rule catalog
│   │   ├── worktrees.ts          # Worktree setup generator
│   │   └── check-tools.ts        # Tool availability
│   ├── analyzers/
│   │   ├── ast-grep.ts           # Structural patterns
│   │   ├── grep-patterns.ts      # Regex-based detection
│   │   ├── knip.ts               # Dead code (JS/TS)
│   │   ├── madge.ts              # Circular deps
│   │   └── tsc.ts                # Implicit any
│   └── rules/                    # ast-grep YAML rules
│       ├── any-type.yml
│       ├── empty-catch.yml
│       ├── bare-except-python.yml
│       ├── unwrap-rust.yml
│       └── ...                   # 13 rules total
└── package.json
```

## Supported Languages

The CLI auto-detects language from file extensions:

| Language | Detection | Tool |
|----------|-----------|------|
| TypeScript/JavaScript | Full (55+ rules) | ast-grep, knip, madge, tsc, grep |
| Python | Structural + supplement | ast-grep rules + ruff/mypy/vulture |
| Rust | Structural + supplement | ast-grep rules + cargo clippy |
| Go | Supplement | staticcheck |
| Any (34 languages) | Regex patterns | grep-based rules |

## License

MIT
