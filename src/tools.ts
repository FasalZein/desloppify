import type { ToolStatus } from "./types";
import { existsSync } from "fs";
import { join } from "path";

function commandExists(cmd: string): boolean {
  const result = Bun.spawnSync(["which", cmd], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return result.exitCode === 0;
}

function localBinExists(cmd: string): boolean {
  try {
    return existsSync(join(process.cwd(), "node_modules", ".bin", cmd));
  } catch {
    return false;
  }
}

function toolAvailable(cmd: string): boolean {
  return commandExists(cmd) || localBinExists(cmd);
}

export function detectTools(): ToolStatus {
  return {
    knip: toolAvailable("knip"),
    madge: toolAvailable("madge"),
    "ast-grep": toolAvailable("sg") || toolAvailable("ast-grep"),
    tsc: toolAvailable("tsc"),
    eslint: toolAvailable("eslint"),
    biome: toolAvailable("biome"),
  };
}

/** Detect what kind of project this is based on files present. */
export function detectProject(targetPath: string): ProjectInfo {
  const has = (file: string) => existsSync(join(targetPath, file));

  return {
    typescript: has("tsconfig.json"),
    javascript: has("package.json"),
    python: has("pyproject.toml") || has("setup.py") || has("requirements.txt"),
    rust: has("Cargo.toml"),
    go: has("go.mod"),
    react: has("package.json") && (
      existsSync(join(targetPath, "node_modules", "react")) ||
      existsSync(join(targetPath, "node_modules", "next"))
    ),
  };
}

export interface ProjectInfo {
  typescript: boolean;
  javascript: boolean;
  python: boolean;
  rust: boolean;
  go: boolean;
  react: boolean;
}

export interface ToolRecommendation {
  name: string;
  description: string;
  install: string;
  relevance: string; // why this tool helps
  available: boolean;
}

/** Get tool recommendations based on project type. */
export function getRecommendations(targetPath: string): ToolRecommendation[] {
  const tools = detectTools();
  const project = detectProject(targetPath);
  const recs: ToolRecommendation[] = [];

  // Always recommended
  recs.push({
    name: "ast-grep",
    description: "Structural pattern matching (34 languages)",
    install: "brew install ast-grep  or  npm i -g @ast-grep/cli",
    relevance: "Core — powers structural rule detection",
    available: tools["ast-grep"],
  });

  // JS/TS ecosystem
  if (project.javascript || project.typescript) {
    recs.push({
      name: "knip",
      description: "Dead code detection for JS/TS",
      install: "bun add -d knip  or  npm i -D knip",
      relevance: "Finds unused exports, files, and dependencies",
      available: tools.knip,
    });

    recs.push({
      name: "madge",
      description: "Circular dependency detection",
      install: "bun add -d madge  or  npm i -D madge",
      relevance: "Finds import cycles between modules",
      available: tools.madge,
    });

    recs.push({
      name: "biome",
      description: "Fast linter + formatter (Rust-based, replaces ESLint + Prettier)",
      install: "bun add -d @biomejs/biome  or  npx @biomejs/biome init",
      relevance: "Blocks slop at write-time — catches issues before they land",
      available: tools.biome,
    });

    recs.push({
      name: "oxlint",
      description: "Blazing fast linter (Rust-based, 50-100x faster than ESLint)",
      install: "bun add -d oxlint  or  npm i -D oxlint",
      relevance: "Fast pre-commit slop blocker — catches common anti-patterns instantly",
      available: commandExists("oxlint") || localBinExists("oxlint"),
    });
  }

  if (project.typescript) {
    recs.push({
      name: "tsc",
      description: "TypeScript compiler (strict mode catches implicit any)",
      install: "bun add -d typescript  or  npm i -D typescript",
      relevance: "Catches weak types and implicit any at compile time",
      available: tools.tsc,
    });
  }

  // Python ecosystem
  if (project.python) {
    recs.push({
      name: "ruff",
      description: "Fast Python linter + formatter (Rust-based)",
      install: "pip install ruff  or  brew install ruff",
      relevance: "Catches Python anti-patterns, replaces flake8 + isort + pyupgrade",
      available: commandExists("ruff"),
    });

    recs.push({
      name: "mypy",
      description: "Static type checker for Python",
      install: "pip install mypy",
      relevance: "Catches type errors and unsafe casts",
      available: commandExists("mypy"),
    });

    recs.push({
      name: "vulture",
      description: "Dead code detection for Python",
      install: "pip install vulture",
      relevance: "Finds unused functions, variables, imports",
      available: commandExists("vulture"),
    });
  }

  // Rust ecosystem
  if (project.rust) {
    recs.push({
      name: "cargo clippy",
      description: "Rust linter (catches common mistakes and anti-patterns)",
      install: "rustup component add clippy",
      relevance: "Catches unwrap(), expect(), and other Rust anti-patterns",
      available: commandExists("cargo"),
    });
  }

  // Go ecosystem
  if (project.go) {
    recs.push({
      name: "staticcheck",
      description: "Go linter (catches bugs and anti-patterns)",
      install: "go install honnef.co/go/tools/cmd/staticcheck@latest",
      relevance: "Catches common Go mistakes beyond what go vet finds",
      available: commandExists("staticcheck"),
    });

    recs.push({
      name: "golangci-lint",
      description: "Meta-linter for Go (runs many linters in parallel)",
      install: "brew install golangci-lint  or  go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest",
      relevance: "Aggregates dozens of Go linters into one fast run",
      available: commandExists("golangci-lint"),
    });
  }

  return recs;
}

export function printToolStatus(tools: ToolStatus): string {
  const lines = Object.entries(tools).map(
    ([name, available]) => `  ${name}: ${available ? "\u2713" : "\u2717"}`
  );
  return lines.join("\n");
}
