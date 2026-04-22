import type { Issue } from "../types";
import { isLineIgnored } from "../ignore";
import type { FileEntry } from "./file-walker";
import { GREP_PATTERN_RULES, type GrepPatternRuleDefinition } from "./grep-pattern-rules";

const RULES: GrepPatternRuleDefinition[] = GREP_PATTERN_RULES;

const TEST_FILE = /\.(test|spec|mock|fixture)\.(ts|tsx|js|jsx|py)$|__tests__|tests\/|test_/;
const KNOWN_NUMERIC_SUFFIX_TERMS = /\b\w*(?:bm25|md5|sha(?:1|224|256|384|512)|base64|http[23]|ipv[46]|oauth2|x(?:86|64)|utf(?:8|16|32)|argon2|pbkdf2|ripemd160|hmac256|blake2[bs]?|chacha20|aes(?:128|192|256))\b/i;

function nextMeaningfulLine(lines: string[], start: number): { index: number; text: string } | null {
  for (let i = start; i < lines.length; i++) {
    const text = lines[i]?.trim() ?? "";
    if (!text) continue;
    return { index: i, text };
  }
  return null;
}

function previousMeaningfulLine(lines: string[], start: number): { index: number; text: string } | null {
  for (let i = start; i >= 0; i--) {
    const text = lines[i]?.trim() ?? "";
    if (!text) continue;
    return { index: i, text };
  }
  return null;
}

function isCommentLine(text: string): boolean {
  return /^(\/\/|#)/.test(text);
}

function isDecorativeBannerBlock(lines: string[], index: number): boolean {
  const prev = previousMeaningfulLine(lines, index - 1);
  const next = nextMeaningfulLine(lines, index + 1);
  return Boolean((prev && isCommentLine(prev.text)) || (next && isCommentLine(next.text)));
}

function hasNestedTernary(line: string): boolean {
  let searchFrom = 0;
  while (true) {
    const firstQuestion = line.indexOf(" ? ", searchFrom);
    if (firstQuestion === -1) return false;

    const firstColon = line.indexOf(" : ", firstQuestion + 3);
    if (firstColon === -1) return false;

    const alternate = line.slice(firstColon + 3);
    const nextQuestion = alternate.indexOf(" ? ");
    if (nextQuestion === -1) return false;

    const beforeNextQuestion = alternate.slice(0, nextQuestion);
    if (!/[,:;)}\]]/.test(beforeNextQuestion)) return true;
    searchFrom = firstQuestion + 3;
  }
}

function isCatchLogAndRethrow(lines: string[], index: number): boolean {
  const next = nextMeaningfulLine(lines, index + 1);
  if (!next || !/^throw\b/.test(next.text)) return false;
  for (let i = index; i >= Math.max(0, index - 5); i--) {
    const text = lines[i]?.trim() ?? "";
    if (!text) continue;
    if (/\bcatch\s*\(/.test(text)) return true;
    if (/^(if|for|while|switch|function|const|let|var)\b/.test(text)) return false;
  }
  return false;
}

function isRedundantBooleanReturn(lines: string[], index: number): boolean {
  const line = lines[index]?.trim() ?? "";
  if (/\b(continue|break|throw)\b/.test(line)) return false;
  for (let i = Math.max(0, index - 3); i < index; i++) {
    if (/^\s*(for|while)\b/.test(lines[i] ?? "")) return false;
  }

  const inlineMatch = line.match(/^if\s*\(.+\)\s*return\s+(true|false);\s*else\s*return\s+(true|false);?$/);
  if (inlineMatch) return inlineMatch[1] !== inlineMatch[2];

  const first = nextMeaningfulLine(lines, index + 1);
  if (!first) return false;

  const ifTrue = first.text === "return true;";
  const ifFalse = first.text === "return false;";
  if (!ifTrue && !ifFalse) return false;

  const afterIf = nextMeaningfulLine(lines, first.index + 1);
  if (!afterIf) return false;

  if (afterIf.text === "}") {
    const fallback = nextMeaningfulLine(lines, afterIf.index + 1);
    return Boolean(fallback && ((ifTrue && fallback.text === "return false;") || (ifFalse && fallback.text === "return true;")));
  }

  if (afterIf.text === "} else {" || afterIf.text === "else {") {
    const fallback = nextMeaningfulLine(lines, afterIf.index + 1);
    return Boolean(fallback && ((ifTrue && fallback.text === "return false;") || (ifFalse && fallback.text === "return true;")));
  }

  return false;
}

function scanFileLines(filePath: string, lines: string[], isTestFile: boolean, ruleFilter?: (id: string) => boolean): Issue[] {
  const found: Issue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const nextLine = lines[i + 1] ?? "";
    for (const rule of RULES) {
      if (ruleFilter && !ruleFilter(rule.id)) continue;
      if (rule.skipTest && isTestFile) continue;
      if (!rule.pattern.test(line)) continue;
      if (isLineIgnored(line, rule.id)) continue;
      if (rule.id === "DEBUG_BREAKPOINT" && /(pattern:\s*\/|desc:\s*"|message:\s*"|fix:\s*"|DEBUG_BREAKPOINT:)/.test(line)) continue;
      if (rule.id === "BANNER_COMMENT" && isDecorativeBannerBlock(lines, i)) continue;
      if (rule.id === "UNNECESSARY_USECALLBACK" && /pattern:\s*\//.test(line)) continue;
      if (rule.id === "NESTED_TERNARY" && (((line.includes(" extends ") && line.includes(" ? ") && line.includes(" : ")) && (/^\s*(export\s+)?type\b/.test(line) || /:\s*[^=]+\bextends\b.+\?.+:/.test(line))) || /\/.*\?[:?]/.test(line) || !hasNestedTernary(line))) continue;
      if (rule.id === "LOG_AND_RETHROW" && !isCatchLogAndRethrow(lines, i)) continue;
      if (rule.id === "UNNECESSARY_INTERMEDIATE") {
        const match = line.match(/^\s*(const|let)\s+(\w+)\s*=\s*.+;\s*$/);
        const variableName = match?.[2];
        if (!variableName || nextLine.trim() !== `return ${variableName};`) continue;
      }
      if (rule.id === "REDUNDANT_BOOLEAN_RETURN" && !isRedundantBooleanReturn(lines, i)) continue;
      if (rule.id === "NUMERIC_SUFFIX" && KNOWN_NUMERIC_SUFFIX_TERMS.test(line)) continue;
      found.push({
        id: rule.id,
        category: rule.category,
        severity: rule.severity,
        tier: rule.tier,
        file: filePath,
        line: i + 1,
        message: rule.message,
        fix: rule.fix,
        tool: "grep",
      });
    }
  }
  return found;
}

export function runGrepPatternsFromEntries(entries: FileEntry[], ruleFilter?: (id: string) => boolean): Issue[] {
  const issues: Issue[] = [];
  for (const entry of entries) {
    const found = scanFileLines(entry.path, entry.lines, TEST_FILE.test(entry.path), ruleFilter);
    issues.push(...found);
  }
  return issues;
}
