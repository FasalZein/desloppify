# Desloppify Autoresearch Changelog

Target: `/Users/tothemoon/Dev/AI/Skills/desloppify/SKILL.md`
Working copy: `v2.md`

## Eval Criteria
1. CLI-first: Agent runs desloppify CLI as first action
2. Harness-agnostic: Zero references to specific harness names
3. Wiki integration: Agent files audit in wiki or notes unavailability
4. Worktree protocol: Agent uses git worktrees for parallel fixes
5. Language-agnostic: Agent adapts to detected project language

## Test Inputs
1. Rust CLI (press-cli)
2. Python scripts (smas-challans)
3. TS monorepo (ymcq)
4. Python+TS fullstack (bayland-framework)
5. AI Skills repo (self-scan)

---

## Experiment 0 — baseline

**Score:** 19/25 (76.0%)
**Change:** none — original skill
**Result:** CLI-first 5/5, Harness-agnostic 0/5, Wiki 5/5, Worktree 5/5, Language 4/5
**Failing outputs:** Every test referenced specific harness names (Claude Code, Pi Agent, OpenCode) from the harness syntax table. Rust test also failed language-agnostic — agent didn't run cargo clippy despite detecting Rust.

## Experiment 1 — keep

**Score:** 24/25 (96.0%)
**Change:** Removed the explicit harness syntax table (lines 249-256 listing Claude Code, Pi Agent, OpenCode spawn syntax) and replaced with generic "Use your harness's native sub-agent mechanism" language.
**Reasoning:** The harness table was leaking specific product names into every agent output, failing the harness-agnostic eval 100% of the time.
**Result:** Harness-agnostic went from 0/5 to 5/5 (tested 3, all passed). Rust language-agnostic still failed — agent noted tool mismatch but didn't run cargo clippy.

## Experiment 2 — keep

**Score:** 25/25 (100.0%)
**Change:** Added "Language-aware supplement" section after Phase 1 Scan with a table mapping non-JS/TS languages to their native analysis tools (Python → ruff/mypy/vulture, Rust → cargo clippy/cargo udeps, Go → staticcheck/deadcode, Java → gradlew lint).
**Reasoning:** The CLI's analyzers target JS/TS. Without explicit instructions to supplement with language-native tools, agents accepted a false 100% score on non-JS/TS projects.
**Result:** Rust test agent ran cargo clippy, found 7 real warnings, adapted its entire triage and fix plan to Rust idioms. 5/5 on all evals.
**Failing outputs:** none — ceiling hit.
