---
managed_by: wiki-forge
protocol_version: 1
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

## Wiki Protocol

Before starting slice work:
- `wiki start-slice desloppify <slice-id> --agent <name> --repo <path>`

During work:
- `wiki checkpoint desloppify --repo <path>`
- `wiki lint-repo desloppify --repo <path>`

Before completion:
- `wiki maintain desloppify --repo <path> --base <rev>`
- update impacted wiki pages from code and tests
- `wiki verify-page desloppify <page...> <level>`
- `wiki verify-slice desloppify <slice-id> --repo <path>`
- `wiki closeout desloppify --repo <path> --base <rev>`
- `wiki gate desloppify --repo <path> --base <rev>`
- `wiki close-slice desloppify <slice-id> --repo <path> --base <rev>`

<!-- wiki-forge:agent-protocol:end -->
