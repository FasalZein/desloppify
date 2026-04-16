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

## Workflow for agents

```
1. desloppify check-tools          → see what's available
2. desloppify scan [path]          → get the full report
3. Review CRITICAL and HIGH issues → these need attention
4. desloppify fix [path] --safe    → auto-fix mechanical issues
5. For judgment-required issues:
   - Read the flagged file + surrounding context
   - Decide: is this catch block necessary? Is this abstraction justified?
   - Apply fixes manually using your edit capabilities
6. desloppify scan [path]          → verify score improved
```

**Judgment rules** (agent decides, CLI only flags):
- Is a try-catch protecting a real boundary or just defensive theater?
- Should duplicate code be consolidated or is the similarity coincidental?
- Is a comment helpful for newcomers or just LLM narration?
- Should fragmented types be merged or do they represent distinct domains?
- Is an abstraction over-engineered or does it serve future extensibility?

## Graceful degradation

When tools are missing, the CLI skips those analyzers and reports reduced coverage:

```
Tools: knip ✓  madge ✗  ast-grep ✓  tsc ✓
Coverage: 8/10 categories active (circular-deps, some duplication unavailable)
```

The CLI never fails because a tool is missing — it just does less.
