import { runBuiltinEntryAnalyzers, runBuiltinTextAnalyzers } from "./analyzer-registry";
import { runAstGrep, runBiome, runCargoClippy, runEslint, runGolangciLint, runKnip, runMadge, runOxlint, runRuff, runRubocop, runStaticcheck, runTsc } from "./analyzers";
import { PACK_CATALOG, PACK_NAMES } from "./domain/pack-catalog";
import type { PackDefinition, PackMeta, PackRunOptions } from "./domain/pack-definition";
import { getExternalTasks, listExternalAnalyzerIds, type BuiltinExternalAnalyzerId, type BuiltinExternalTask, type ExternalAnalyzerDefinition } from "./external-analyzer-registry";
import { GO_FILE, JS_TS_SOURCE_FILE, JS_TS_TEXT_FILE, PYTHON_FILE, RUBY_FILE, RUST_FILE, filterEntries, isGoExtendedRule, isGoPatternRule, isJsTsRule, isPythonAstRule, isPythonExtendedRule, isPythonPatternRule, isRubyExtendedRule, isRubyPatternRule, isRustAstRule, matches } from "./pack-filters";
import type { PackName } from "./types";

const JS_TS_EXTERNAL_ANALYZERS: readonly ExternalAnalyzerDefinition<BuiltinExternalAnalyzerId>[] = [
  {
    id: "knip",
    enabled: (tools, options) => tools.knip && (!options.category || options.category === "dead-code"),
    createTask: (targetPath) => ({ name: "knip", promise: runKnip(targetPath) }),
  },
  {
    id: "madge",
    enabled: (tools, options) => tools.madge && (options.category === "circular-deps" || Boolean(options.withMadge)),
    createTask: (targetPath) => ({ name: "madge", promise: runMadge(targetPath) }),
  },
  {
    id: "ast-grep",
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
    enabled: (tools, options) => tools.tsc && (!options.category || options.category === "weak-types"),
    createTask: (targetPath) => ({ name: "tsc", promise: runTsc(targetPath) }),
  },
  {
    id: "eslint",
    enabled: (tools, options) => Boolean(tools.eslint) && !options.category,
    createTask: (targetPath) => ({ name: "eslint", promise: runEslint(targetPath) }),
  },
  {
    id: "biome",
    enabled: (tools, options) => Boolean(tools.biome) && !options.category,
    createTask: (targetPath) => ({ name: "biome", promise: runBiome(targetPath) }),
  },
  {
    id: "oxlint",
    enabled: (tools, options) => Boolean(tools.oxlint) && !options.category,
    createTask: (targetPath) => ({ name: "oxlint", promise: runOxlint(targetPath) }),
  },
];

const PYTHON_EXTERNAL_ANALYZERS: readonly ExternalAnalyzerDefinition<BuiltinExternalAnalyzerId>[] = [
  {
    id: "ast-grep",
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
    enabled: (tools, options) => Boolean(tools.ruff) && !options.category,
    createTask: (targetPath) => ({ name: "ruff", promise: runRuff(targetPath) }),
  },
];

const RUST_EXTERNAL_ANALYZERS: readonly ExternalAnalyzerDefinition<BuiltinExternalAnalyzerId>[] = [
  {
    id: "ast-grep",
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
    enabled: (tools, options) => Boolean(tools["cargo-clippy"]) && !options.category,
    createTask: (targetPath) => ({ name: "cargo-clippy", promise: runCargoClippy(targetPath) }),
  },
];

const GO_EXTERNAL_ANALYZERS: readonly ExternalAnalyzerDefinition<BuiltinExternalAnalyzerId>[] = [
  {
    id: "staticcheck",
    enabled: (tools, options) => Boolean(tools.staticcheck) && !options.category,
    createTask: (targetPath) => ({ name: "staticcheck", promise: runStaticcheck(targetPath) }),
  },
  {
    id: "golangci-lint",
    enabled: (tools, options) => Boolean(tools["golangci-lint"]) && !options.category,
    createTask: (targetPath) => ({ name: "golangci-lint", promise: runGolangciLint(targetPath) }),
  },
];

const RUBY_EXTERNAL_ANALYZERS: readonly ExternalAnalyzerDefinition<BuiltinExternalAnalyzerId>[] = [
  {
    id: "rubocop",
    enabled: (tools, options) => Boolean(tools.rubocop) && !options.category,
    createTask: (targetPath) => ({ name: "rubocop", promise: runRubocop(targetPath) }),
  },
];

const BUILTIN_PACKS: Record<PackName, PackDefinition> = {
  "js-ts": {
    meta: {
      name: "js-ts",
      ...PACK_CATALOG["js-ts"],
    },
    runInternal: (entries, options = {}) => {
      const textEntries = filterEntries(entries, JS_TS_TEXT_FILE);
      const sourceEntries = filterEntries(entries, JS_TS_SOURCE_FILE);
      return [
        ...runBuiltinTextAnalyzers(textEntries, { ruleFilter: isJsTsRule }),
        ...runBuiltinEntryAnalyzers(sourceEntries, {
          ids: ["file-metrics", "architecture-profile"],
          architecture: options.architecture,
        }),
      ];
    },
    listExternalAnalyzerIds: (tools, options = {}) => listExternalAnalyzerIds(JS_TS_EXTERNAL_ANALYZERS, tools, options),
    getExternalTasks: (targetPath, tools, options = {}) => getExternalTasks(JS_TS_EXTERNAL_ANALYZERS, targetPath, tools, options),
  },
  python: {
    meta: {
      name: "python",
      ...PACK_CATALOG.python,
    },
    runInternal: (entries) => {
      const pythonEntries = filterEntries(entries, PYTHON_FILE);
      return [
        ...runBuiltinTextAnalyzers(pythonEntries, {
          ids: ["grep-patterns", "grep-extended"],
          ruleFilter: (ruleId) => isPythonPatternRule(ruleId) || isPythonExtendedRule(ruleId),
        }),
      ];
    },
    listExternalAnalyzerIds: (tools, options = {}) => listExternalAnalyzerIds(PYTHON_EXTERNAL_ANALYZERS, tools, options),
    getExternalTasks: (targetPath, tools, options = {}) => getExternalTasks(PYTHON_EXTERNAL_ANALYZERS, targetPath, tools, options),
  },
  rust: {
    meta: {
      name: "rust",
      ...PACK_CATALOG.rust,
    },
    runInternal: (entries) => {
      const rustEntries = filterEntries(entries, RUST_FILE);
      return [
        ...runBuiltinTextAnalyzers(rustEntries, {
          ids: ["grep-patterns", "grep-extended"],
          ruleFilter: () => false,
        }),
      ];
    },
    listExternalAnalyzerIds: (tools, options = {}) => listExternalAnalyzerIds(RUST_EXTERNAL_ANALYZERS, tools, options),
    getExternalTasks: (targetPath, tools, options = {}) => getExternalTasks(RUST_EXTERNAL_ANALYZERS, targetPath, tools, options),
  },
  go: {
    meta: {
      name: "go",
      ...PACK_CATALOG.go,
    },
    runInternal: (entries) => {
      const goEntries = filterEntries(entries, GO_FILE);
      return [
        ...runBuiltinTextAnalyzers(goEntries, {
          ids: ["grep-patterns", "grep-extended"],
          ruleFilter: (ruleId) => isGoPatternRule(ruleId) || isGoExtendedRule(ruleId),
        }),
      ];
    },
    listExternalAnalyzerIds: (tools, options = {}) => listExternalAnalyzerIds(GO_EXTERNAL_ANALYZERS, tools, options),
    getExternalTasks: (targetPath, tools, options = {}) => getExternalTasks(GO_EXTERNAL_ANALYZERS, targetPath, tools, options),
  },
  ruby: {
    meta: {
      name: "ruby",
      ...PACK_CATALOG.ruby,
    },
    runInternal: (entries) => {
      const rubyEntries = filterEntries(entries, RUBY_FILE);
      return [
        ...runBuiltinTextAnalyzers(rubyEntries, {
          ids: ["grep-patterns", "grep-extended"],
          ruleFilter: (ruleId) => isRubyPatternRule(ruleId) || isRubyExtendedRule(ruleId),
        }),
      ];
    },
    listExternalAnalyzerIds: (tools, options = {}) => listExternalAnalyzerIds(RUBY_EXTERNAL_ANALYZERS, tools, options),
    getExternalTasks: (targetPath, tools, options = {}) => getExternalTasks(RUBY_EXTERNAL_ANALYZERS, targetPath, tools, options),
  },
};

export type PackExternalTask = BuiltinExternalTask;
export type { PackDefinition, PackMeta, PackRunOptions } from "./domain/pack-definition";

export function listBuiltinPackDefinitions(): PackDefinition[] {
  return PACK_NAMES.map((pack) => BUILTIN_PACKS[pack]);
}

export function getBuiltinPackDefinition(pack: PackName): PackDefinition {
  return BUILTIN_PACKS[pack];
}
