---
managed_by: wiki-forge
protocol_version: 2
project: desloppify
scope: root
applies_to: .
---
<!-- wiki-forge:agent-protocol:start -->
# Agent Protocol

> Managed by wiki-forge. Keep local repo-specific notes below the managed block.
> `AGENTS.md` and `CLAUDE.md` carry the same sync-managed protocol block. Do not treat them as separate policy sources.

Scope: repo root

Use `/forge` for non-trivial implementation work.
Use `/wiki` for retrieval, refresh, drift, verification, and closeout review.
If slash-skill aliases are unavailable, run the equivalent `wiki` CLI lifecycle directly.
`wiki protocol sync` only syncs this managed block; it does not enforce behavior or sync skill policy.

## Code Quality

Codex (GPT-5-class reviewer) reviews every change before it merges. Write as if a stricter reviewer is watching:
- Smaller, more focused diffs. Every changed line should trace to the task.
- Honest names. No `foo`, no `handleStuff`, no vague `utils`.
- Tight types. No `any`, no unchecked casts, no silent `as unknown as T`.
- Real error handling. No bare `catch {}`, no swallowed promises, no `throw new Error("TODO")`.
- Tests that describe behavior, not implementation. Delete shallow tests you replace.
- Match the surrounding style even when you'd design differently.

Sloppy code costs a review round-trip. Writing it right the first time is faster than arguing with a reviewer.

## Workflow Enforcement

Load `/forge` for tracked slice work. Load `/wiki` for knowledge-layer work.
The skills define all available commands. This block enforces the contract, not the command surface.

Agent surface (3 commands): `wiki forge plan desloppify <feature-name>`, `wiki forge run desloppify [slice-id] --repo <path>`, `wiki forge next desloppify`
Session start: `wiki resume desloppify --repo <path> --base <rev>`

<!-- wiki-forge:agent-protocol:end -->
