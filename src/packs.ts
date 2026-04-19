import type { FileEntry } from "./analyzers/file-walker";
import { runBuiltinEntryAnalyzers, runBuiltinTextAnalyzers } from "./analyzer-registry";
import { getBuiltinExternalTasks } from "./external-analyzer-registry";
import { JS_TS_SOURCE_FILE, JS_TS_TEXT_FILE, PYTHON_FILE, filterEntries, isJsTsRule, isPythonExtendedRule, isPythonPatternRule } from "./pack-filters";
import type { Issue, PackName, PackSelection, ToolStatus } from "./types";

export interface PackMeta {
  name: PackName;
  description: string;
}

export interface PackRunOptions {
  architecture?: string;
  category?: string;
  partial?: boolean;
}

export interface PackExternalTask {
  name: string;
  promise: Promise<Issue[]>;
}

const PACKS: Record<PackName, PackMeta> = {
  "js-ts": {
    name: "js-ts",
    description: "JavaScript / TypeScript / React heuristics and tool adapters",
  },
  python: {
    name: "python",
    description: "Python heuristics with python-scoped grep and ast-grep rules",
  },
};


export { isRuleInPack } from "./pack-filters";

export function isPackName(value: string): value is PackName {
  return value in PACKS;
}

export function resolvePackSelection(value?: string): PackSelection {
  if (!value) return { name: "js-ts", explicit: false };
  if (!isPackName(value)) throw new Error(`Unknown pack: ${value}`);
  return { name: value, explicit: true };
}

export function getPackMeta(pack: PackName): PackMeta {
  return PACKS[pack];
}

export function runPackInternalAnalyzers(pack: PackName, entries: FileEntry[], options: PackRunOptions = {}): Issue[] {
  switch (pack) {
    case "js-ts": {
      const textEntries = filterEntries(entries, JS_TS_TEXT_FILE);
      const sourceEntries = filterEntries(entries, JS_TS_SOURCE_FILE);
      return [
        ...runBuiltinTextAnalyzers(textEntries, { ruleFilter: isJsTsRule }),
        ...runBuiltinEntryAnalyzers(sourceEntries, {
          ids: ["file-metrics", "architecture-profile"],
          architecture: options.architecture,
        }),
      ];
    }
    case "python": {
      const pythonEntries = filterEntries(entries, PYTHON_FILE);
      return [
        ...runBuiltinTextAnalyzers(pythonEntries, {
          ids: ["grep-patterns", "grep-extended"],
          ruleFilter: (ruleId) => isPythonPatternRule(ruleId) || isPythonExtendedRule(ruleId),
        }),
      ];
    }
  }
}

export function getPackExternalTasks(
  pack: PackName,
  targetPath: string,
  tools: ToolStatus,
  options: PackRunOptions = {},
): PackExternalTask[] {
  return getBuiltinExternalTasks(pack, targetPath, tools, options);
}
