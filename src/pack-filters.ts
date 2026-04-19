import type { FileEntry } from "./analyzers/file-walker";
import type { PackName } from "./types";

export const JS_TS_SOURCE_FILE = /\.(ts|tsx|js|jsx)$/;
export const JS_TS_TEXT_FILE = /\.(ts|tsx|js|jsx|html)$/;
export const PYTHON_FILE = /\.py$/;

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

export function matches(filePath: string, pattern: RegExp): boolean {
  return pattern.test(filePath);
}

export function filterEntries(entries: FileEntry[], pattern: RegExp): FileEntry[] {
  return entries.filter((entry) => matches(entry.path, pattern));
}

export function isJsTsRule(ruleId: string): boolean {
  return !PYTHON_GREP_PATTERN_RULE_IDS.has(ruleId)
    && !PYTHON_GREP_EXTENDED_RULE_IDS.has(ruleId)
    && !PYTHON_AST_GREP_RULE_IDS.has(ruleId)
    && !RUST_AST_GREP_RULE_IDS.has(ruleId);
}

export function isPythonPatternRule(ruleId: string): boolean {
  return PYTHON_GREP_PATTERN_RULE_IDS.has(ruleId);
}

export function isPythonExtendedRule(ruleId: string): boolean {
  return PYTHON_GREP_EXTENDED_RULE_IDS.has(ruleId);
}

export function isPythonAstRule(ruleId: string): boolean {
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
