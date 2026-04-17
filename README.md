# Desloppify

Your AI wrote spaghetti. This eats it.

Desloppify finds the mess that AI coding agents leave behind — banner comments nobody asked for, placeholder variables named `data2`, empty catch blocks, god files with 1200 lines, `forEach(async ...)` that silently drops promises, and the classic `// TODO: replace with real implementation` that shipped to prod.

The CLI scans. Your agent (or you) decides what to fix. Fixes run on isolated git worktrees so nothing breaks.

## Quick start

```bash
# Run it (requires Bun)
bunx desloppify scan . --pack js-ts
bunx desloppify score . --pack js-ts

# Via GitHub (while npm is pending)
bunx github:FasalZein/desloppify scan . --pack js-ts
```

## Install as a skill

Desloppify is skill-driven. Install it as an agent skill and say "desloppify" or "clean up this code" — your agent handles the rest.

```bash
# Install the skill (works with any agent that reads SKILL.md)
npx skills add FasalZein/desloppify
```

The skill teaches your agent the full workflow: scan, triage, spawn fix sub-agents on worktrees, merge, verify. You don't need to memorize commands — the skill drives everything.

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
Fix agents spawn on git worktrees (one per category, parallel)
  ↓
Merge → re-scan → confirm score improved
```

The CLI handles detection deterministically. The agent handles judgment — is this try-catch necessary? Is this duplication intentional? Is this comment helpful or AI narration?

## Commands

```bash
desloppify scan [path] --pack js-ts             # detect issues with explicit pack selection
desloppify scan [path] --json --pack js-ts      # machine-readable normalized findings output
desloppify scan [path] --wiki --pack js-ts      # wiki-forge review JSON
desloppify scan [path] --handoff --pack js-ts   # compact markdown handoff
desloppify scan [path] --category complexity --pack js-ts
desloppify scan [path] --architecture modular-monolith --pack js-ts
desloppify scan [path] --staged --pack js-ts    # staged git changes only
desloppify scan [path] --changed --pack js-ts   # current branch diff only
desloppify score [path] --pack js-ts            # weighted quality grade (A+ to F)
desloppify score [path] --architecture modular-monolith --pack js-ts
desloppify rules                                 # list all detection rules
desloppify rules --architecture modular-monolith # active architecture bundle only
desloppify fix [path] --safe                     # auto-fix safe mechanical issues
desloppify check-tools                           # show available analyzers
desloppify worktrees [path]                      # print worktree setup commands
```

## Git hooks for changed files only

```bash
bun run setup-hooks
```

This installs repo-local hooks via `.githooks/`:

- `pre-commit` → scans `--staged`
- `pre-push` → scans `--changed`

Both hooks scan only the diff on your branch, not the whole repo, and block only on `HIGH`/`CRITICAL` findings.
Set `DESLOPPIFY_PACK=<pack>` if you need a different pack in hook runs.

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
| `js-ts` | Available | Current JavaScript / TypeScript / React-oriented analyzer bundle |

More packs can be added later without changing the core scan/report contract.

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
