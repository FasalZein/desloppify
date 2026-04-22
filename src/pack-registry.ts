import { runBuiltinEntryAnalyzers, runBuiltinTextAnalyzers } from "./analyzer-registry";
import { PACK_CATALOG, PACK_NAMES } from "./domain/pack-catalog";
import type { PackDefinition, PackMeta, PackRunOptions } from "./domain/pack-definition";
import { getBuiltinExternalTasks, listBuiltinExternalAnalyzerIds, type BuiltinExternalTask } from "./external-analyzer-registry";
import { GO_FILE, JS_TS_SOURCE_FILE, JS_TS_TEXT_FILE, PYTHON_FILE, RUBY_FILE, RUST_FILE, filterEntries, isGoExtendedRule, isGoPatternRule, isJsTsRule, isPythonExtendedRule, isPythonPatternRule, isRubyExtendedRule, isRubyPatternRule } from "./pack-filters";
import type { PackName } from "./types";

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
    listExternalAnalyzerIds: (tools, options = {}) => listBuiltinExternalAnalyzerIds("js-ts", tools, options),
    getExternalTasks: (targetPath, tools, options = {}) => getBuiltinExternalTasks("js-ts", targetPath, tools, options),
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
    listExternalAnalyzerIds: (tools, options = {}) => listBuiltinExternalAnalyzerIds("python", tools, options),
    getExternalTasks: (targetPath, tools, options = {}) => getBuiltinExternalTasks("python", targetPath, tools, options),
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
    listExternalAnalyzerIds: (tools, options = {}) => listBuiltinExternalAnalyzerIds("rust", tools, options),
    getExternalTasks: (targetPath, tools, options = {}) => getBuiltinExternalTasks("rust", targetPath, tools, options),
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
    listExternalAnalyzerIds: (tools, options = {}) => listBuiltinExternalAnalyzerIds("go", tools, options),
    getExternalTasks: (targetPath, tools, options = {}) => getBuiltinExternalTasks("go", targetPath, tools, options),
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
    listExternalAnalyzerIds: (tools, options = {}) => listBuiltinExternalAnalyzerIds("ruby", tools, options),
    getExternalTasks: (targetPath, tools, options = {}) => getBuiltinExternalTasks("ruby", targetPath, tools, options),
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
