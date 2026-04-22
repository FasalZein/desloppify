import { runAstGrep, runBiome, runCargoClippy, runEslint, runGolangciLint, runKnip, runMadge, runOxlint, runRuff, runRubocop, runStaticcheck, runTsc } from "./analyzers";
import { JS_TS_SOURCE_FILE, PYTHON_FILE, RUST_FILE, isJsTsRule, isPythonAstRule, isRustAstRule, matches } from "./pack-filters";
import type { PackName, ToolStatus } from "./types";
import type { ExternalAnalyzerResult } from "./analyzers/external-result";

export interface BuiltinExternalTask {
  name: string;
  promise: Promise<ExternalAnalyzerResult>;
}

type BuiltinExternalAnalyzerId = "knip" | "madge" | "ast-grep" | "tsc" | "eslint" | "biome" | "oxlint" | "ruff" | "cargo-clippy" | "staticcheck" | "golangci-lint" | "rubocop";

interface BuiltinExternalRunOptions {
  category?: string;
  partial?: boolean;
  withMadge?: boolean;
}

interface BuiltinExternalAnalyzerDefinition {
  id: BuiltinExternalAnalyzerId;
  pack: PackName;
  enabled: (tools: ToolStatus, options: BuiltinExternalRunOptions) => boolean;
  createTask: (targetPath: string) => BuiltinExternalTask;
}

const BUILTIN_EXTERNAL_ANALYZERS: BuiltinExternalAnalyzerDefinition[] = [
  {
    id: "knip",
    pack: "js-ts",
    enabled: (tools, options) => tools.knip && (!options.category || options.category === "dead-code"),
    createTask: (targetPath) => ({ name: "knip", promise: runKnip(targetPath) }),
  },
  {
    id: "madge",
    pack: "js-ts",
    enabled: (tools, options) => tools.madge && (options.category === "circular-deps" || Boolean(options.withMadge)),
    createTask: (targetPath) => ({ name: "madge", promise: runMadge(targetPath) }),
  },
  {
    id: "ast-grep",
    pack: "js-ts",
    enabled: (tools, options) => tools["ast-grep"] && options.category !== "circular-deps",
    createTask: (targetPath) => ({
      name: "ast-grep",
      promise: runAstGrep(targetPath, {
        ruleFilter: isJsTsRule,
        fileFilter: (filePath) => matches(filePath, JS_TS_SOURCE_FILE),
      }),
    }),
  },
  {
    id: "tsc",
    pack: "js-ts",
    enabled: (tools, options) => tools.tsc && (!options.category || options.category === "weak-types"),
    createTask: (targetPath) => ({ name: "tsc", promise: runTsc(targetPath) }),
  },
  {
    id: "eslint",
    pack: "js-ts",
    enabled: (tools, options) => Boolean(tools.eslint) && !options.category,
    createTask: (targetPath) => ({ name: "eslint", promise: runEslint(targetPath) }),
  },
  {
    id: "biome",
    pack: "js-ts",
    enabled: (tools, options) => Boolean(tools.biome) && !options.category,
    createTask: (targetPath) => ({ name: "biome", promise: runBiome(targetPath) }),
  },
  {
    id: "oxlint",
    pack: "js-ts",
    enabled: (tools, options) => Boolean(tools.oxlint) && !options.category,
    createTask: (targetPath) => ({ name: "oxlint", promise: runOxlint(targetPath) }),
  },
  {
    id: "ast-grep",
    pack: "python",
    enabled: (tools) => tools["ast-grep"],
    createTask: (targetPath) => ({
      name: "ast-grep",
      promise: runAstGrep(targetPath, {
        ruleFilter: isPythonAstRule,
        fileFilter: (filePath) => matches(filePath, PYTHON_FILE),
      }),
    }),
  },
  {
    id: "ruff",
    pack: "python",
    enabled: (tools, options) => Boolean(tools.ruff) && !options.category,
    createTask: (targetPath) => ({ name: "ruff", promise: runRuff(targetPath) }),
  },
  {
    id: "ast-grep",
    pack: "rust",
    enabled: (tools) => tools["ast-grep"],
    createTask: (targetPath) => ({
      name: "ast-grep",
      promise: runAstGrep(targetPath, {
        ruleFilter: isRustAstRule,
        fileFilter: (filePath) => matches(filePath, RUST_FILE),
      }),
    }),
  },
  {
    id: "cargo-clippy",
    pack: "rust",
    enabled: (tools, options) => Boolean(tools["cargo-clippy"]) && !options.category,
    createTask: (targetPath) => ({ name: "cargo-clippy", promise: runCargoClippy(targetPath) }),
  },
  {
    id: "staticcheck",
    pack: "go",
    enabled: (tools, options) => Boolean(tools.staticcheck) && !options.category,
    createTask: (targetPath) => ({ name: "staticcheck", promise: runStaticcheck(targetPath) }),
  },
  {
    id: "golangci-lint",
    pack: "go",
    enabled: (tools, options) => Boolean(tools["golangci-lint"]) && !options.category,
    createTask: (targetPath) => ({ name: "golangci-lint", promise: runGolangciLint(targetPath) }),
  },
  {
    id: "rubocop",
    pack: "ruby",
    enabled: (tools, options) => Boolean(tools.rubocop) && !options.category,
    createTask: (targetPath) => ({ name: "rubocop", promise: runRubocop(targetPath) }),
  },
];

export function listBuiltinExternalAnalyzerIds(
  pack: PackName,
  tools: ToolStatus,
  options: BuiltinExternalRunOptions = {},
): BuiltinExternalAnalyzerId[] {
  if (options.partial) return [];

  return BUILTIN_EXTERNAL_ANALYZERS
    .filter((analyzer) => analyzer.pack === pack && analyzer.enabled(tools, options))
    .map((analyzer) => analyzer.id);
}

export function getBuiltinExternalTasks(
  pack: PackName,
  targetPath: string,
  tools: ToolStatus,
  options: BuiltinExternalRunOptions = {},
): BuiltinExternalTask[] {
  if (options.partial) return [];

  return BUILTIN_EXTERNAL_ANALYZERS
    .filter((analyzer) => analyzer.pack === pack && analyzer.enabled(tools, options))
    .map((analyzer) => analyzer.createTask(targetPath));
}
