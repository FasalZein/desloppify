# Changelog

All notable changes to `desloppify` will be documented in this file.

This changelog was backfilled from the shipped release history starting with `1.0.0`.

## [1.0.2] - 2026-04-22

### Added
- Benchmark workflows for fetching pinned repos, generating snapshots, and rendering cohort reports.
- Delta reporting improvements including scoped gating, markdown/comment outputs, hotspot summaries, and saved delta artifacts.
- Repo-local config and plugin support plus the stable root package API (`scanProject`, `scanProjectSummary`, `summarizeScanReport`, `calculateScore`, `compareScanReports`).
- Broader first-party pack coverage and pack suggestion/detection support across `js-ts`, `python`, `rust`, `go`, and `ruby`.

### Changed
- Default JS/TS scan and score flows now keep `madge` off the fast path; circular dependency analysis is opt-in via `--with-madge` or `--category circular-deps`.
- `install-hooks` now scaffolds managed `.githooks`, preserves existing hook managers/hooks, auto-detects the repo pack, and supports whole-repo mode with `DESLOPPIFY_HOOK_SCOPE=repo`.
- Pack behavior is centralized behind `PackDefinition`/`packs.ts`, scan orchestration behind `scan-workflow.ts`, and grep-pattern rules are decomposed by smell family without changing the flat rule contract.
- README and skill docs now reflect the shipped pack set, hook behavior, and the opt-in `madge` workflow.

### Fixed
- Normalized workspace and external-analyzer paths so reports, deltas, and worktree triage stay stable on real repos and monorepos.
- CI/publish workflows now install `ast-grep`, matching local test and publish expectations.

## [1.0.1] - 2026-04-17

### Added
- Saved scan artifacts and workflow-aware outputs (`latest.findings.json`, markdown report, wiki/handoff payloads) for agent-driven cleanup flows.
- Guided onboarding with `install-skill`, `install-hooks`, and `setup` plus clearer tool recommendations.
- `install-hooks` command, polished scan UI, and dynamic LOC/file-metric threshold improvements.
- GitHub Actions CI and trusted publishing workflows for tagged releases.

### Changed
- Reworked README and skill guidance around the skill-driven workflow instead of hardcoded rule counts.
- Tightened CLI version/help/tool-detection behavior for more reliable first-run UX.

### Fixed
- Reduced self-scan UI noise and related onboarding false positives.

## [1.0.0] - 2026-04-17

### Added
- Initial public release of the agent-agnostic `desloppify` CLI.
- Core `scan`, `fix`, `rules`, and `check-tools` workflow with terminal UI and npm/bunx install support.
- Project-aware tool recommendations, architecture-profile analysis, diff-based hook support, and pack-aware workflow output.
- Worktree-oriented skill guidance for agent-assisted cleanup.
