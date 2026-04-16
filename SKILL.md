---
name: desloppify
description: >
  Agent-agnostic code cleanup. CLI detects issues across 10 categories (dead code, weak types, AI slop,
  circular deps, duplication, defensive programming, legacy code, type fragmentation, inconsistency, complexity).
  Agent interprets results and applies judgment fixes. Use when: desloppify, clean up code, remove slop,
  code quality audit, deep refactor, remove AI slop, remove dead code, fix types.
---

# Desloppify

CLI-powered code cleanup. The CLI detects; you interpret and fix.

Not a linter. Catches what linters miss: duplicated abstractions, hidden error swallowing, weak types that compile but lie, circular dependencies, and LLM-generated slop.

## When to invoke

- "desloppify", "clean up code", "remove slop", "code quality", "remove dead code"
- After a sprint of AI-assisted development
- Before a major release
- Periodic hygiene on any codebase

## Required Skills

This skill integrates with:
- `/wiki` — file the scan audit as research, run closeout gates after fixes
- `/tdd` — optional; run existing tests to verify fixes don't break behavior (do NOT write new tests for cleanup work)

If `/wiki` is unavailable, skip the filing and closeout steps but still run the full fix workflow.

## CLI commands

```bash
desloppify scan [path]                # full analysis → JSON report
desloppify scan [path] --category <id> # single category only
desloppify scan [path] --json         # machine-readable (default)
desloppify scan [path] --markdown     # human-readable report
desloppify fix [path] --safe          # Tier 1: mechanical fixes only
desloppify fix [path] --confident     # Tier 1-2: + AST-validated fixes
desloppify fix [path] --all           # Tier 1-3: + cross-file fixes
desloppify rules                      # list all detection rules
desloppify check-tools                # show which analyzers are available
```

## Safety tiers

The CLI never requires tests. It uses whatever safety nets are available.

| Tier | What it fixes | Safety net required |
|------|--------------|-------------------|
| 1 (safe) | Unused imports, dead console.log, banner comments, obvious slop | Git checkpoint only |
| 2 (confident) | Unreferenced private symbols, empty catch blocks, redundant type annotations | AST parse validation |
| 3 (all) | Dead exports, circular deps, weak types, legacy paths | Type checker or build step |
| flag-only | Public API changes, dynamic access patterns, serialization | Never auto-fixed |

Before any `fix` command, the CLI auto-creates a git checkpoint: `desloppify-checkpoint-<ts>`.

## Scan output format

```json
{
  "version": "1.0.0",
  "path": "src/",
  "tools": { "knip": true, "madge": true, "ast-grep": true, "tsc": true },
  "score": 74,
  "summary": { "critical": 2, "high": 5, "medium": 8, "low": 3 },
  "categories": {
    "dead-code": { "count": 5, "fixable": 4 },
    "weak-types": { "count": 3, "fixable": 2 }
  },
  "issues": [
    {
      "id": "DEAD_EXPORT",
      "category": "dead-code",
      "severity": "HIGH",
      "tier": 3,
      "file": "src/utils/format.ts",
      "line": 42,
      "message": "Unused export: formatLegacy",
      "fix": "Remove export — no importers found",
      "tool": "knip"
    }
  ]
}
```

Exit code: `0` = clean, `1` = issues found, `2` = tool error.

## The 10 categories

Each maps to detection rules and underlying tools:

### 1. dead-code
Unused exports, functions, files, dependencies, variables, dead branches.
**Tool:** `knip` (JS/TS), `vulture` (Python), grep fallback.
**Rules:** `DEAD_EXPORT`, `DEAD_FUNCTION`, `DEAD_FILE`, `DEAD_DEPENDENCY`, `DEAD_VARIABLE`, `DEAD_BRANCH`

### 2. weak-types
`any`, `unknown` (as cop-out), `object`, `Function`, `{}`, implicit any, `# type: ignore`.
**Tool:** `ast-grep` rules + `tsc --noEmit` diagnostics.
**Rules:** `ANY_TYPE`, `UNKNOWN_COPOUT`, `IMPLICIT_ANY`, `OBJECT_TYPE`, `FUNCTION_TYPE`, `TYPE_IGNORE`

### 3. ai-slop
LLM artifacts: banner separators, narration comments, obvious JSX labels, process comments, apologetic comments, redundant type annotations, over-extracted single-use components.
**Tool:** `ast-grep` rules + pattern matching.
**Rules:** `BANNER_COMMENT`, `NARRATION_COMMENT`, `OBVIOUS_JSX_LABEL`, `PROCESS_COMMENT`, `APOLOGETIC_COMMENT`, `REDUNDANT_ANNOTATION`, `OVER_EXTRACTED`

### 4. circular-deps
Import cycles between modules.
**Tool:** `madge --circular` (JS/TS), `import-linter` (Python).
**Rules:** `CIRCULAR_IMPORT`

### 5. duplication
Copy-pasted logic, near-duplicate functions, repeated utility patterns.
**Tool:** `ast-grep` structural matching + grep for literal duplication.
**Rules:** `DUPLICATE_FUNCTION`, `DUPLICATE_BLOCK`, `DUPLICATE_LITERAL`

### 6. defensive-programming
Empty catch blocks, catch-and-return-default, catch-log-continue, optional chaining 3+ deep, null coalescing theater, safety-theater null checks on non-nullable types.
**Tool:** `ast-grep` rules.
**Rules:** `EMPTY_CATCH`, `CATCH_RETURN_DEFAULT`, `CATCH_LOG_CONTINUE`, `DEEP_OPTIONAL_CHAIN`, `NULL_THEATER`, `SAFETY_THEATER`

### 7. legacy-code
`@deprecated` annotations, TODO-remove comments, feature flags always on/off, version-check shims, migration remnants, backward-compat re-exports.
**Tool:** grep patterns + `ast-grep`.
**Rules:** `DEPRECATED_ANNOTATION`, `TODO_REMOVE`, `DEAD_FEATURE_FLAG`, `VERSION_SHIM`, `MIGRATION_REMNANT`, `COMPAT_REEXPORT`

### 8. type-fragmentation
Same type defined in multiple files, types that should extend a common base, inline types that should be extracted, re-exported types importable from source.
**Tool:** `ast-grep` + cross-file analysis.
**Rules:** `DUPLICATE_TYPE`, `MISSING_BASE_TYPE`, `INLINE_TYPE`, `REDUNDANT_REEXPORT`

### 9. inconsistency
Mixed naming conventions within a file, inconsistent export patterns, mixed function styles (arrow vs declaration) without reason.
**Tool:** `ast-grep` + pattern analysis.
**Rules:** `MIXED_NAMING`, `MIXED_EXPORTS`, `MIXED_FUNCTION_STYLE`

### 10. complexity
Functions over 50 lines, files over 500 lines, deeply nested conditionals (3+), parameter counts over 5, cyclomatic complexity outliers.
**Tool:** line counting + `ast-grep` nesting rules.
**Rules:** `LONG_FUNCTION`, `LONG_FILE`, `DEEP_NESTING`, `MANY_PARAMS`, `HIGH_COMPLEXITY`

## Workflow

The scan IS the research. No web search needed — the CLI audit produces the evidence. The wiki layer files it so decisions are traceable.

```
Phase 1: Scan (main agent, read-only, no worktree)
Phase 2: File audit in wiki
Phase 3: Triage — main agent decides what to fix, skip, or flag-only
Phase 4: Parallel fix sub-agents (one per active category, each on a git worktree)
Phase 5: Merge worktrees + run existing tests
Phase 6: Wiki closeout
```

### Phase 1: Scan

```bash
desloppify check-tools          # see what's available
desloppify scan [path]          # full JSON report
```

Save the full JSON output. You will slice it by category and pass relevant sections to each sub-agent in Phase 4. Do not start fixing before the full scan is complete.

**Language-aware supplement:** The CLI's built-in analyzers target JS/TS primarily. If the project's primary language is NOT JavaScript/TypeScript and the scan returns few or zero findings, supplement with the language's native tools:

| Language | Supplement commands |
|----------|-------------------|
| Python | `ruff check .` or `flake8`, `mypy .`, `vulture .` |
| Rust | `cargo clippy -- -W clippy::all`, `cargo udeps` |
| Go | `staticcheck ./...`, `deadcode .` |
| Java/Kotlin | `./gradlew lint` or equivalent |

Add any findings from these tools to the scan report before proceeding to triage. If no native tools are available, note the coverage gap in the report.

### Phase 2: File audit in wiki

If `/wiki` is available, file the scan report as a research artifact:

```bash
wiki research file <project> "desloppify-audit-$(date +%Y-%m-%d)"
```

This creates a traceable record in `research/projects/<project>/`. Paste in the scan's markdown summary and score. This is not a forge research step — the scan is the evidence, not a literature review.

### Phase 3: Triage

Review CRITICAL and HIGH issues first. For each active category (categories with count > 0), decide:

- **Fix**: worth addressing, safe to delegate to a sub-agent
- **Skip**: issues are by design or not worth the churn — document why in the wiki
- **Flag-only**: public API changes, dynamic patterns, serialization — never auto-fix; leave a comment in code

Judgment rules (agent decides, CLI only flags):
- Is a try-catch protecting a real boundary or just defensive theater?
- Should duplicate code be consolidated or is the similarity coincidental?
- Is a comment helpful for newcomers or just LLM narration?
- Should fragmented types be merged or do they represent distinct domains?
- Is an abstraction over-engineered or does it serve future extensibility?

### Phase 4: Parallel fix sub-agents

Spawn one sub-agent per active "Fix" category. Do NOT spawn sub-agents for skipped or flag-only categories. A clean codebase may need 2-3 agents; a messy one 6-7. The scan output determines parallelism.

#### Worktree protocol

Each sub-agent gets its own git worktree. Git worktrees are harness-agnostic — it's only the agent spawn syntax that varies.

```bash
# Main agent: set up a worktree per category before spawning
git worktree add ../desloppify-dead-code -b fix/dead-code
git worktree add ../desloppify-weak-types -b fix/weak-types
# ... one per active category

# Each sub-agent: fix, then commit
cd <worktree-path>
desloppify fix . --safe           # mechanical fixes first
# apply judgment fixes manually
git add -p && git commit -m "fix(<category>): desloppify cleanup"

# Main agent: after all sub-agents complete, merge and clean up
git checkout main
git merge fix/dead-code fix/weak-types ...
git worktree remove ../desloppify-dead-code
git worktree remove ../desloppify-weak-types
```

If worktrees cause merge conflicts between categories (e.g., two categories touch the same file), resolve on main after the merge.

#### Sub-agent prompt template

Fill ALL fields before dispatching. Pass the category's issue slice from the scan JSON directly — never make sub-agents re-run the scan.

```
Fix code quality issues for ONE category in the following worktree.

CATEGORY: [e.g., dead-code]
WORKTREE PATH: [absolute path to worktree]
SCAN FINDINGS (this category only):
[paste the relevant JSON slice from Phase 1 scan output]

STEPS:
1. cd to the worktree path
2. Run: desloppify fix . --safe    (mechanical fixes — Tier 1 only)
3. For each remaining HIGH/CRITICAL finding in the scan slice:
   - Read the flagged file
   - Apply the fix described in the issue's "fix" field
   - Skip anything marked tier 3 or flag-only without type checker confirmation
4. Run: desloppify scan . --category [category-id]
   - Score must improve or stay equal. If it worsens, revert and report.
5. Commit all changes: git add -p && git commit -m "fix([category]): desloppify cleanup"

RETURN: list of files changed, issues fixed, issues skipped (with reason), final category score.
```

#### Spawning sub-agents

Use your harness's native sub-agent mechanism to spawn one agent per active "Fix" category. Pass the filled prompt template above as the task. Run all sub-agents in parallel when your harness supports it.

If your harness does not support sub-agents, run each category sequentially in the main context and skip worktrees — apply fixes directly on the working branch instead.

### Phase 5: Merge + verify

After all sub-agents complete and report back:

1. Review each sub-agent's return (files changed, skipped issues, final score)
2. Merge all worktree branches into main (resolve any conflicts)
3. Remove all worktrees: `git worktree prune`
4. Run the full scan again to confirm overall score improved: `desloppify scan [path]`
5. Run existing tests to verify no behavior was broken. If the project has a test command, run it now. Do NOT write new tests — cleanup work does not require new test coverage.

### Phase 6: Wiki closeout

If `/wiki` is available:

```bash
wiki checkpoint <project> --repo <path>
wiki maintain <project> --repo <path> --base <rev>
wiki closeout <project> --repo <path> --base <rev>
wiki gate <project> --repo <path> --base <rev>
```

Update any wiki pages that reference modules where cleanup changed behavior-visible structure (e.g., a module's public exports changed due to dead-code removal). Use `wiki verify-page <project> <page> code-verified` after updating.

## Graceful degradation

When tools are missing, the CLI skips those analyzers and reports reduced coverage:

```
Tools: knip ✓  madge ✗  ast-grep ✓  tsc ✓
Coverage: 8/10 categories active (circular-deps, some duplication unavailable)
```

The CLI never fails because a tool is missing — it just does less.

When sub-agent support is unavailable, run categories sequentially in the main context. Skip worktrees. The workflow is the same; only parallelism is lost.
