# Desloppify

The AI slop destroyer. Catches 116+ anti-patterns across 16 categories that AI coding agents introduce into codebases.

```bash
bunx desloppify scan .
```

Works with `npx` too. Requires [Bun](https://bun.sh).

## What it does

CLI does deterministic detection. Your agent handles triage and fixes. Each fix category runs on its own git worktree for safe parallel execution.

```
desloppify scan [path]              # detect issues (pretty terminal output)
desloppify scan [path] --json       # machine-readable for agents
desloppify scan [path] --category   # single category
desloppify score [path]             # weighted quality grade
desloppify fix [path] --safe        # auto-fix tier 1 (safe mechanical fixes)
desloppify rules                    # list all 116+ rules
desloppify check-tools              # show available analyzers
```

## What it catches

| Category | Examples |
|----------|----------|
| AI Slop | Banner comments, narration, hedging, placeholder data, console.log |
| Complexity | God files (1200+ LOC), barrel exports, mixed concerns, deep nesting, monolith routes |
| Security | Hardcoded secrets, SQL injection, eval/exec, pickle, hardcoded URLs |
| Test Quality | Empty tests, weak assertions, sleepy tests, skipped tests, snapshot overuse |
| Async Correctness | forEach async, blocking requests, sequential awaits, callback/promise mix |
| Dead Code | Unused exports, functions, files, dependencies (via knip) |
| Weak Types | `any`, `as any`, `object`, `Function`, `@ts-ignore` |
| Runtime Validation | Unvalidated req.body, JSON.parse casts, fetch response casts |
| Accessibility | Interactive divs, missing alt text, inputs without labels |
| Circular Dependencies | Import cycles between modules (via madge) |
| Defensive Programming | Empty catch, catch-log-continue, mutable defaults |
| Naming & Semantics | Numeric suffixes, generic bucket files, Python builtin shadowing |
| Inconsistency | Mixed imports, wildcard re-exports, scattered env, hardcoded Tailwind colors |
| Legacy Code | @deprecated, TODO/FIXME, moment.js, callback-style APIs |
| Type Fragmentation | Duplicate types, complex inline types |
| Duplication | Near-identical functions, repeated string literals |

## Scoring

Each issue deducts points based on severity (critical=5, high=3, medium=1, low=0.5) multiplied by category weight (security=2x, async/types=1.5x, ai-slop=0.5x). Per-category cap at 20 points prevents one category from dominating.

Grades: A+ (95-100) A (85-94) B (70-84) C (50-69) D (30-49) F (0-29)

## Requirements

- [Bun](https://bun.sh) runtime
- [ast-grep](https://ast-grep.github.io) — structural pattern matching

Optional (auto-detected):
- `knip` — dead code (JS/TS)
- `madge` — circular deps (JS/TS)
- `tsc` — implicit any detection

## Languages

| Language | Coverage |
|----------|----------|
| TypeScript / JavaScript | Full — 55+ rules via ast-grep, knip, madge, tsc, grep |
| Python | Structural + supplement — ast-grep rules + ruff/mypy/vulture |
| Rust | Structural + supplement — ast-grep rules + cargo clippy |
| Go | Supplement — staticcheck |
| Any (34 languages) | Regex patterns — grep-based rules |

## Agent integration

The `skills/desloppify/SKILL.md` file ships with the package. Any agent that reads SKILL.md can use it. The CLI outputs both human-readable terminal UI and `--json` for machine consumption.

## False positives

```bash
# Inline suppression
console.log("intentional"); // desloppify:ignore CONSOLE_LOG

# Project-level ignores (.desloppifyignore, gitignore syntax)
dist/
coverage/
*.gen.ts
```

## License

MIT
