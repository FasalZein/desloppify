# Packs and tool adapters

## First-party packs

- `js-ts`
- `python`
- `rust`
- `go`
- `ruby`

The category model is broader than the original 10-category framing. The current scanner spans dead code, weak types, AI slop, circular deps, duplication, defensive programming, legacy code, type fragmentation, inconsistency, complexity, security slop, test quality, async correctness, runtime validation, accessibility, and naming/semantics.

## External tool adapters

- JS/TS: `knip`, `madge`, `ast-grep`, `tsc`, `eslint`, `biome`, `oxlint`
- Python: `ast-grep`, `ruff`
- Rust: `ast-grep`, `cargo clippy`
- Go: `staticcheck`, `golangci-lint`
- Ruby: `rubocop`

Recommendations-only today:
- `oxfmt`, `mypy`, `vulture`

## Behavior notes

- Full JS/TS scans skip `madge` by default so the main scan path stays fast and does not block on circular-deps analysis.
- Use `--with-madge` or `--category circular-deps` when you want circular dependency analysis.
- On monorepos with simple `package.json` workspaces like `apps/*` and `packages/*`, madge runs per workspace package.
- Partial scans (`--staged`, `--changed`) skip whole-project analyzers like `knip`, `madge`, `ast-grep`, and `tsc`.
- Missing tools or missing config are skipped instead of failing the whole scan.
- External analyzer failures surface as warnings; do not treat them as a clean bill of health.
- Repo-local binaries in `node_modules/.bin` are resolved automatically when scanning or fixing another checkout.
- Fallback anti-pattern coverage includes no-op callback fallbacks, `|| {}` / `?? {}` object fallbacks, `|| []` / `?? []` collection fallbacks, and `Promise.resolve([]|{}|null|undefined)` success-masking fallbacks.

## Setup shortcuts

**JS/TS**
```bash
bun add -d knip madge
bun add -d @biomejs/biome
bun add -d oxlint
brew install ast-grep
```

**Python**
```bash
pip install ruff mypy vulture
brew install ast-grep
```

**Rust**
```bash
rustup component add clippy
brew install ast-grep
```

**Go**
```bash
go install honnef.co/go/tools/cmd/staticcheck@latest
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
```

**Ruby**
```bash
gem install rubocop
```
