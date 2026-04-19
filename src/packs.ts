import type { FileEntry } from "./analyzers/file-walker";
import { runArchitectureProfileFromEntries } from "./analyzers/architecture-profile";
import { runAstGrep } from "./analyzers/ast-grep";
import { runFileMetricsFromEntries } from "./analyzers/file-metrics";
import { runKnip } from "./analyzers/knip";
import { runBuiltinTextAnalyzers } from "./analyzer-registry";
import { runMadge } from "./analyzers/madge";
import { runTsc } from "./analyzers/tsc";
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

const JS_TS_SOURCE_FILE = /\.(ts|tsx|js|jsx)$/;
const JS_TS_TEXT_FILE = /\.(ts|tsx|js|jsx|html)$/;
const PYTHON_FILE = /\.py$/;

const PYTHON_GREP_PATTERN_RULE_IDS = new Set([
  "BANNER_COMMENT",
  "TODO_REMOVE",
  "HEDGING_COMMENT",
  "SECTION_LABEL_COMMENT",
  "INSTRUCTIONAL_COMMENT",
  "EXPLICIT_TRUE_COMPARE",
  "PLACEHOLDER_VAR_NAME",
  "LINT_ESCAPE",
  "FIXME_HACK_XXX",
  "HARDCODED_SECRET",
  "HARDCODED_URL",
  "COMMENTED_CODE_BLOCK",
  "DEBUG_BREAKPOINT",
]);

const PYTHON_GREP_EXTENDED_RULE_IDS = new Set([
  "ASSERT_TRUE",
  "SKIPPED_TEST",
  "REQUESTS_IN_ASYNC",
  "EVAL_EXEC",
  "PICKLE_LOADS",
  "MUTABLE_DEFAULT",
  "BUILTIN_SHADOW",
  "ITERROWS",
]);

const PYTHON_AST_GREP_RULE_IDS = new Set([
  "BARE_EXCEPT",
  "PASS_STUB",
  "PRINT_STATEMENT",
  "BROAD_EXCEPT",
  "STAR_IMPORT",
]);

const RUST_AST_GREP_RULE_IDS = new Set([
  "UNWRAP_CALL",
  "EXPECT_CALL",
  "TODO_MACRO",
]);

function matches(filePath: string, pattern: RegExp): boolean {
  return pattern.test(filePath);
}

function filterEntries(entries: FileEntry[], pattern: RegExp): FileEntry[] {
  return entries.filter((entry) => matches(entry.path, pattern));
}

function isJsTsRule(ruleId: string): boolean {
  return !PYTHON_GREP_PATTERN_RULE_IDS.has(ruleId) && !PYTHON_GREP_EXTENDED_RULE_IDS.has(ruleId) && !PYTHON_AST_GREP_RULE_IDS.has(ruleId) && !RUST_AST_GREP_RULE_IDS.has(ruleId);
}

function isPythonPatternRule(ruleId: string): boolean {
  return PYTHON_GREP_PATTERN_RULE_IDS.has(ruleId);
}

function isPythonExtendedRule(ruleId: string): boolean {
  return PYTHON_GREP_EXTENDED_RULE_IDS.has(ruleId);
}

function isPythonAstRule(ruleId: string): boolean {
  return PYTHON_AST_GREP_RULE_IDS.has(ruleId);
}

export function isRuleInPack(pack: PackName, ruleId: string): boolean {
  switch (pack) {
    case "js-ts":
      return isJsTsRule(ruleId);
    case "python":
      return isPythonPatternRule(ruleId) || isPythonExtendedRule(ruleId) || isPythonAstRule(ruleId);
  }
}

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
        ...runFileMetricsFromEntries(sourceEntries, { architecture: options.architecture }),
        ...runArchitectureProfileFromEntries(sourceEntries, { architecture: options.architecture }),
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
  const tasks: PackExternalTask[] = [];
  if (options.partial) return tasks;

  switch (pack) {
    case "js-ts": {
      if (tools.knip && (!options.category || options.category === "dead-code")) {
        tasks.push({ name: "knip", promise: runKnip(targetPath) });
      }
      if (tools.madge && (!options.category || options.category === "circular-deps")) {
        tasks.push({ name: "madge", promise: runMadge(targetPath) });
      }
      if (tools["ast-grep"]) {
        tasks.push({
          name: "ast-grep",
          promise: runAstGrep(targetPath, {
            ruleFilter: isJsTsRule,
            fileFilter: (filePath) => matches(filePath, JS_TS_SOURCE_FILE),
          }),
        });
      }
      if (tools.tsc && (!options.category || options.category === "weak-types")) {
        tasks.push({ name: "tsc", promise: runTsc(targetPath) });
      }
      return tasks;
    }
    case "python": {
      if (tools["ast-grep"]) {
        tasks.push({
          name: "ast-grep",
          promise: runAstGrep(targetPath, {
            ruleFilter: isPythonAstRule,
            fileFilter: (filePath) => matches(filePath, PYTHON_FILE),
          }),
        });
      }
      return tasks;
    }
  }
}
