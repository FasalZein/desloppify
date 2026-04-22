import type { FileEntry } from "./analyzers/file-walker";
import { PACK_CATALOG } from "./domain/pack-catalog";
import type { PackName } from "./types";

export const JS_TS_SOURCE_FILE = PACK_CATALOG["js-ts"].sourceFilePattern;
export const JS_TS_TEXT_FILE = PACK_CATALOG["js-ts"].textFilePattern;
export const PYTHON_FILE = PACK_CATALOG.python.filePattern;
export const RUST_FILE = PACK_CATALOG.rust.filePattern;
export const GO_FILE = PACK_CATALOG.go.filePattern;
export const RUBY_FILE = PACK_CATALOG.ruby.filePattern;

const PYTHON_GREP_PATTERN_RULE_IDS = new Set<string>(PACK_CATALOG.python.patternRuleIds);
const PYTHON_GREP_EXTENDED_RULE_IDS = new Set<string>(PACK_CATALOG.python.extendedRuleIds);
const PYTHON_AST_GREP_RULE_IDS = new Set<string>(PACK_CATALOG.python.astRuleIds);
const RUST_AST_GREP_RULE_IDS = new Set<string>(PACK_CATALOG.rust.astRuleIds);
const GO_GREP_PATTERN_RULE_IDS = new Set<string>(PACK_CATALOG.go.patternRuleIds);
const GO_GREP_EXTENDED_RULE_IDS = new Set<string>(PACK_CATALOG.go.extendedRuleIds);
const RUBY_GREP_PATTERN_RULE_IDS = new Set<string>(PACK_CATALOG.ruby.patternRuleIds);
const RUBY_GREP_EXTENDED_RULE_IDS = new Set<string>(PACK_CATALOG.ruby.extendedRuleIds);
const JS_TS_DISABLED_RULE_IDS = new Set<string>(PACK_CATALOG["js-ts"].disabledRuleIds);

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
    && !RUST_AST_GREP_RULE_IDS.has(ruleId)
    && !GO_GREP_PATTERN_RULE_IDS.has(ruleId)
    && !GO_GREP_EXTENDED_RULE_IDS.has(ruleId)
    && !RUBY_GREP_PATTERN_RULE_IDS.has(ruleId)
    && !RUBY_GREP_EXTENDED_RULE_IDS.has(ruleId)
    && !JS_TS_DISABLED_RULE_IDS.has(ruleId);
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

export function isRustAstRule(ruleId: string): boolean {
  return RUST_AST_GREP_RULE_IDS.has(ruleId);
}

export function isGoPatternRule(ruleId: string): boolean {
  return GO_GREP_PATTERN_RULE_IDS.has(ruleId);
}

export function isGoExtendedRule(ruleId: string): boolean {
  return GO_GREP_EXTENDED_RULE_IDS.has(ruleId);
}

export function isRubyPatternRule(ruleId: string): boolean {
  return RUBY_GREP_PATTERN_RULE_IDS.has(ruleId);
}

export function isRubyExtendedRule(ruleId: string): boolean {
  return RUBY_GREP_EXTENDED_RULE_IDS.has(ruleId);
}

export function isRuleInPack(pack: PackName, ruleId: string): boolean {
  switch (pack) {
    case "js-ts":
      return isJsTsRule(ruleId);
    case "python":
      return isPythonPatternRule(ruleId) || isPythonExtendedRule(ruleId) || isPythonAstRule(ruleId);
    case "rust":
      return isRustAstRule(ruleId);
    case "go":
      return isGoPatternRule(ruleId) || isGoExtendedRule(ruleId);
    case "ruby":
      return isRubyPatternRule(ruleId) || isRubyExtendedRule(ruleId);
  }
}
