import type { FileEntry } from "./analyzers/file-walker";
import { runBuiltinEntryAnalyzers, runBuiltinTextAnalyzers } from "./analyzer-registry";
import type { ArchitectureProfileName } from "./architecture";
import { PACK_CATALOG } from "./domain/pack-catalog";
import { getBuiltinExternalTasks, type BuiltinExternalTask } from "./external-analyzer-registry";
import { GO_FILE, JS_TS_SOURCE_FILE, JS_TS_TEXT_FILE, PYTHON_FILE, RUBY_FILE, RUST_FILE, filterEntries, isGoExtendedRule, isGoPatternRule, isJsTsRule, isPythonExtendedRule, isPythonPatternRule, isRubyExtendedRule, isRubyPatternRule } from "./pack-filters";
import type { Issue, PackName, ToolStatus } from "./types";

export interface PackMeta {
  name: PackName;
  description: string;
}

export interface PackRunOptions {
  architecture?: ArchitectureProfileName;
  category?: string;
  partial?: boolean;
  withMadge?: boolean;
}

interface BuiltinPackDefinition {
  meta: PackMeta;
  runInternal: (entries: FileEntry[], options?: PackRunOptions) => Issue[];
  getExternalTasks: (targetPath: string, tools: ToolStatus, options?: PackRunOptions) => BuiltinExternalTask[];
}

const BUILTIN_PACKS: Record<PackName, BuiltinPackDefinition> = {
  "js-ts": {
    meta: {
      name: "js-ts",
      description: PACK_CATALOG["js-ts"].description,
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
    getExternalTasks: (targetPath, tools, options = {}) => getBuiltinExternalTasks("js-ts", targetPath, tools, options),
  },
  python: {
    meta: {
      name: "python",
      description: PACK_CATALOG.python.description,
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
    getExternalTasks: (targetPath, tools, options = {}) => getBuiltinExternalTasks("python", targetPath, tools, options),
  },
  rust: {
    meta: {
      name: "rust",
      description: PACK_CATALOG.rust.description,
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
    getExternalTasks: (targetPath, tools, options = {}) => getBuiltinExternalTasks("rust", targetPath, tools, options),
  },
  go: {
    meta: {
      name: "go",
      description: PACK_CATALOG.go.description,
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
    getExternalTasks: (targetPath, tools, options = {}) => getBuiltinExternalTasks("go", targetPath, tools, options),
  },
  ruby: {
    meta: {
      name: "ruby",
      description: PACK_CATALOG.ruby.description,
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
    getExternalTasks: (targetPath, tools, options = {}) => getBuiltinExternalTasks("ruby", targetPath, tools, options),
  },
};

export type PackExternalTask = BuiltinExternalTask;

export function getBuiltinPackDefinition(pack: PackName): BuiltinPackDefinition {
  return BUILTIN_PACKS[pack];
}
