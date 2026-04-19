import type { FileEntry } from "./analyzers/file-walker";
import { runBuiltinEntryAnalyzers, runBuiltinTextAnalyzers } from "./analyzer-registry";
import { getBuiltinExternalTasks, type BuiltinExternalTask } from "./external-analyzer-registry";
import { JS_TS_SOURCE_FILE, JS_TS_TEXT_FILE, PYTHON_FILE, filterEntries, isJsTsRule, isPythonExtendedRule, isPythonPatternRule } from "./pack-filters";
import type { Issue, PackName, ToolStatus } from "./types";

export interface PackMeta {
  name: PackName;
  description: string;
}

export interface PackRunOptions {
  architecture?: string;
  category?: string;
  partial?: boolean;
}

export interface BuiltinPackDefinition {
  meta: PackMeta;
  runInternal: (entries: FileEntry[], options?: PackRunOptions) => Issue[];
  getExternalTasks: (targetPath: string, tools: ToolStatus, options?: PackRunOptions) => BuiltinExternalTask[];
}

export const BUILTIN_PACKS: Record<PackName, BuiltinPackDefinition> = {
  "js-ts": {
    meta: {
      name: "js-ts",
      description: "JavaScript / TypeScript / React heuristics and tool adapters",
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
      description: "Python heuristics with python-scoped grep and ast-grep rules",
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
};

export function getBuiltinPackDefinition(pack: PackName): BuiltinPackDefinition {
  return BUILTIN_PACKS[pack];
}
