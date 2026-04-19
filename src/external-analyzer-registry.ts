import { runAstGrep } from "./analyzers/ast-grep";
import { runKnip } from "./analyzers/knip";
import { runMadge } from "./analyzers/madge";
import { runTsc } from "./analyzers/tsc";
import { JS_TS_SOURCE_FILE, PYTHON_FILE, isJsTsRule, isPythonAstRule, matches } from "./pack-filters";
import type { Issue, PackName, ToolStatus } from "./types";

export interface BuiltinExternalTask {
  name: string;
  promise: Promise<Issue[]>;
}

export type BuiltinExternalAnalyzerId = "knip" | "madge" | "ast-grep" | "tsc";

export interface BuiltinExternalRunOptions {
  category?: string;
  partial?: boolean;
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
    enabled: (tools, options) => tools.madge && (!options.category || options.category === "circular-deps"),
    createTask: (targetPath) => ({ name: "madge", promise: runMadge(targetPath) }),
  },
  {
    id: "ast-grep",
    pack: "js-ts",
    enabled: (tools) => tools["ast-grep"],
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
