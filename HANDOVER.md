# Desloppify Handover

## What is this

Bun-based CLI that detects AI-introduced code anti-patterns. 116+ rules across 16 categories. Uses ast-grep for structural matching, regex for pattern detection, and optional external tools (knip, madge, tsc) for deeper analysis. Published to npm as `desloppify`, run via `bunx desloppify scan .`.

## Current state

- **Version:** 0.0.1 on npm (note: 2.0.0 was published and unpublished — can republish 0.0.1 after 24hr cooldown from April 16 2026 ~03:57 UTC)
- **Repo:** https://github.com/FasalZein/desloppify
- **Run it:** `bunx github:FasalZein/desloppify scan .` (until npm 0.0.1 is published)
- **Self-scan:** A+ (98/100), 2 remaining issues (both legitimate)

## What was done this session

1. **BUILTIN_SHADOW false positive fixed** — trimmed from 31 builtins to 18 dangerous-only. 597→46 hits on bayland.
2. **Performance: shared file walker** — 3 independent glob walks consolidated into 1. Internal analysis: 226ms for 431 files (32ms walk + 194ms analysis). Bottleneck is external tools at 25s.
3. **Terminal UI with @clack/prompts** — burnt orange theme, spinner, score box, category tables, human-readable rule names (no SNAKE_CASE in output).
4. **npm publishing** — published 2.0.0, then unpublished. Package name `desloppify` is reserved. 0.0.1 ready to publish after cooldown.
5. **CLI UX fixes** — `version` and `help` work as subcommands, exit codes documented, tool detection checks `node_modules/.bin/`.
6. **Project-aware check-tools** — detects project type, recommends biome/oxlint/knip/madge/ruff/mypy/clippy/staticcheck with install commands.
7. **README/SKILL.md rewrite** — funny, skill-driven, no hardcoded counts, bunx as primary usage.
8. **Rust port research** — concluded not worth it. External tools are all JS, and Bun binary is 51MB floor. Distribution via bunx (30KB download) is the right path.

## Architecture

```
src/
├── cli.ts                 # Entry point (citty framework)
├── ui.ts                  # Terminal UI (@clack/prompts, burnt orange theme)
├── types.ts               # Core types (Issue, Category, ToolStatus)
├── tools.ts               # Tool detection + project-aware recommendations
├── ignore.ts              # .desloppifyignore + inline suppression
├── analyzers/
│   ├── file-walker.ts     # Shared single-pass file walker (all analyzers use this)
│   ├── grep-patterns.ts   # ~35 regex rules (ai-slop, security, complexity)
│   ├── grep-extended.ts   # ~30 rules (test-quality, async, a11y, naming)
│   ├── file-metrics.ts    # File-level structural analysis (LOC, imports, exports)
│   ├── ast-grep.ts        # Structural patterns via ast-grep YAML rules
│   ├── knip.ts            # Dead code detection (external tool)
│   ├── madge.ts           # Circular deps (external tool)
│   └── tsc.ts             # Implicit any (external tool)
├── commands/
│   ├── scan.ts            # Main scan command (pretty output default, --json for agents)
│   ├── score.ts           # Weighted scoring (severity × category weight, capped)
│   ├── fix.ts             # Auto-fix engine (T1: line removal, T2+: agent-driven)
│   ├── rules.ts           # Rule catalog listing
│   ├── check-tools.ts     # Project-aware tool recommendations
│   └── worktrees.ts       # Git worktree setup generator
└── rules/                 # ast-grep YAML rules (13 files)
```

**Key design:** `file-walker.ts` walks the tree once, produces `FileEntry[]` (path + content + lines). All three internal analyzers run synchronously on this shared data. External tools run in parallel via `Promise.all`.

## What needs doing

### Immediate (before next npm publish)

- [ ] **Publish 0.0.1 to npm** — wait for 24hr cooldown, then `cd desloppify && npm publish --access public`
- [ ] **Deprecate 2.0.0** — `npm deprecate desloppify@2.0.0 "Use 0.0.1 or later"`

### Short-term improvements

- [ ] **Fix the 2 self-scan issues:**
  - `CALLBACK_PROMISE_MIX` in `grep-extended.ts:115` — the rule pattern itself uses `.then(` which triggers the rule. Tighten the regex or add inline suppression.
  - `COMMENTED_CODE_BLOCK` in `rules.ts:139` — rule catalog has commented descriptions that look like code. Add inline suppression.
- [ ] **Score command needs clack UI** — `score.ts` still uses raw ANSI escapes, not clack. Should match scan's burnt orange theme.
- [ ] **Test suite** — zero tests. Add at least:
  - Rule regex tests (each rule against known positive/negative inputs)
  - File walker tests (respects .desloppifyignore)
  - Scoring tests (severity × weight × cap math)
- [ ] **CI/CD** — GitHub Actions: lint, test, auto-publish on tag

### Medium-term features

- [ ] **More rules** — the 116 rules cover a lot but there's room for:
  - React: missing key prop, state mutation, useEffect dependency issues
  - CSS: !important abuse, magic numbers, z-index wars
  - API: inconsistent error response shapes, missing pagination
  - Config: env vars without defaults, missing .env.example
- [ ] **Native import graph** — replace knip/madge with Rust-based import analysis (via petgraph or tree-sitter). Would eliminate the JS tool dependency for dead-code and circular-dep detection.
- [ ] **Watch mode** — `desloppify watch .` for continuous scanning during development
- [ ] **Config file** — `.desloppify.json` for custom severity overrides, category weights, rule enable/disable
- [ ] **Diff-only mode** — `desloppify scan --diff HEAD~1` to only scan changed files (for CI)

### Research completed (in wiki)

- **Rust port** — researched and decided against. See `research/projects/desloppify/rust-cli-port-feasibility-analysis.md` in wiki. TL;DR: Rust gives 3MB binary and 6x internal speedup, but external tools are 99% of scan time and are all JS. Distribution via bunx (30KB) is better than a compiled binary.

## Key decisions

1. **Bun-only** — uses Bun.file, Bun.spawnSync, Bun.Glob. Not Node-compatible. `npx` works because the shebang is `#!/usr/bin/env bun`.
2. **Agent-agnostic** — no Claude/OpenAI-specific code. SKILL.md is a convention any agent can read.
3. **Pretty output by default** — terminal report with clack UI. `--json` for machine consumption.
4. **Zero-dep internal analysis** — grep-patterns, grep-extended, file-metrics use zero external tools. External tools (knip, madge, tsc) are optional enhancements.
5. **Single file walk** — `file-walker.ts` reads all files once, passes to all analyzers. Adding a new internal analyzer means writing a function that takes `FileEntry[]`.

## How to add a new rule

**Grep rule (regex):** Add to `grep-patterns.ts` or `grep-extended.ts`:
```typescript
{
  id: "MY_RULE",
  pattern: /regex/,
  category: "ai-slop",
  severity: "MEDIUM",
  tier: 0,
  message: "What's wrong and why",
  fix: "How to fix it",  // optional
  fileFilter: /\.(ts|tsx)$/,  // optional
}
```

**Structural rule (AST):** Add a YAML file in `src/rules/` and map it in `ast-grep.ts`.

**File-level rule:** Add to `file-metrics.ts` (has access to full file content, lines, LOC).

Then add a human-readable label in `ui.ts` `HUMAN_RULES` map.

## Scoring formula

```
penalty = severity_points × category_weight
per_category_cap = 20 points
score = max(0, 100 - sum(capped_penalties))
```

Severity: CRITICAL=5, HIGH=3, MEDIUM=1, LOW=0.5
Weights: security=2x, async/validation=2x, types/defensive=1.5x, ai-slop/naming=0.5x

## Resume command

```bash
wiki resume desloppify --repo /Users/tothemoon/Dev/AI/Skills/desloppify --base 9598d66
```
