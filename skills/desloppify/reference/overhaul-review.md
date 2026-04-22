# Overhaul review mode

Use this optional workflow when the user wants more than a quick scan/fix pass:
- "overhaul this repo"
- "do a systematic codebase review"
- "audit this whole codebase"
- "give me a phased cleanup plan"

This is a **skill-layer workflow**, not a new CLI command.

## First decision: pick a mode

Always choose scope up front.

### 1) Surgical
Use when the user wants one theme in one session.

Examples:
- dead code only
- weak types only
- test quality only
- architecture only

### 2) Systematic
Use when the user wants a structured repo review without an overwhelming dump.

Rules:
- review section by section
- keep each section to the highest-value findings
- pause after each section before moving on

### 3) Full audit
Use when the user wants the broadest review and a phased roadmap.

Rules:
- cover every review section
- group by execution order, not by raw scan order
- explicitly separate now / later / out-of-scope

## Inputs to use

Start with real desloppify evidence, not pure opinion.

Default inputs:
1. `desloppify check-tools [path]`
2. `desloppify scan [path] --pack <pack>`
3. `.desloppify/reports/latest.findings.json`
4. `desloppify report [path]`
5. `desloppify delta ...` if comparing before/after or gating regressions

For large repos, prefer:

```bash
desloppify scan [path] --json --summary --pack js-ts
desloppify report [path] --json --summary
```

## Review sections

### 1) Architecture
Cover:
- module boundaries
- layering violations
- hotspots
- oversized files / mixed concerns
- circular dependency risk when relevant

Output:
- top architecture risks
- likely failure mode if unchanged
- recommended sequence

### 2) Code quality
Cover:
- dead code
- weak types
- fallback anti-patterns
- defensive slop
- inconsistency / naming / legacy drag

Output:
- highest-leverage cleanup targets
- what should be fixed now vs deferred

### 3) Tests
Cover:
- weak coverage on risky paths
- skipped / empty / sleepy tests
- missing characterization tests before refactor
- slow or brittle suites

Output:
- tests required before refactor
- tests that can wait

### 4) Performance
Cover:
- scan hotspots from saved reports
- large-file concentration
- dependency/circular-deps cost where relevant
- obvious runtime/build drag

Output:
- performance-sensitive cleanup candidates
- whether each item is a real bottleneck or just code smell

### 5) Dependencies and modernization
Cover:
- outdated tooling
- replaceable dependencies
- repo-local tool gaps
- modernization opportunities already unlocked by the current stack

Output:
- dependency actions by urgency
- what to leave alone

## Required outputs

### Impact / effort matrix

Use four buckets:
- **Do first**
- **Plan carefully**
- **If time**
- **Skip / defer**

### Not in scope

Always list what you are not tackling now and why.

### What already exists

Call out underused helpers, patterns, or workflows already present in the codebase.

### Failure modes

For major recommendations, state:
- what can fail in production
- whether current code makes it visible or silent
- whether tests cover it

### Execution order

Give a numbered, shippable order.

Good pattern:
1. add or fix tests
2. remove blockers / typecheck issues
3. make mechanical cleanup changes
4. do riskier structural work
5. verify with scan/report/delta

## Recommendation style

Do not dump a giant list.

For each major finding:
- lead with the recommendation
- give 2–3 options max
- include effort / risk / blast radius briefly
- prefer direct guidance over neutral brainstorming

## What not to do

- do not turn every desloppify run into a full audit
- do not bloat the CLI with overhaul-only behavior
- do not replace saved artifacts with prose summaries
- do not silently expand scope after choosing Surgical/Systematic/Full

## Default stance

- default to the normal scan/fix flow unless the user clearly wants a broader overhaul review
- use **Systematic** as the default overhaul mode when the user wants a full review but has not asked for exhaustive depth
