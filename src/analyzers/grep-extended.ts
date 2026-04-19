import type { Issue } from "../types";
import { isLineIgnored } from "../ignore";
import type { FileEntry } from "./file-walker";
import { GREP_EXTENDED_RULES, type GrepExtendedRuleDefinition } from "./grep-extended-rules";

const ACTIVE_RULES = GREP_EXTENDED_RULES.filter((r) => r.pattern.source !== "^$");
const KNOWN_NUMERIC_SUFFIX_TERMS = /\b\w*(?:bm25|md5|sha(?:1|224|256|384|512)|base64|http[23]|ipv[46]|oauth2|x(?:86|64)|utf(?:8|16|32)|argon2|pbkdf2|ripemd160|hmac256|blake2[bs]?|chacha20|aes(?:128|192|256)|sm2|sumx2)\b/i;

function isTestOrScriptFile(filePath: string): boolean {
  return /(\.test\.|\.spec\.|__tests__|\/tests\/|\/scripts\/|(^|\/)test-[^/]+\.)/.test(filePath);
}

function hasNearbyFetch(lines: string[], index: number): boolean {
  for (let i = Math.max(0, index - 2); i <= index; i++) {
    const line = lines[i] ?? "";
    if (/Bun\.file\s*\(/.test(line)) return false;
    if (/\bfetch\s*\(/.test(line)) return true;
  }
  return false;
}

function isPromiseWrappedAsyncMap(lines: string[], index: number): boolean {
  const nearby = lines.slice(Math.max(0, index - 3), Math.min(lines.length, index + 3)).join("\n");
  if (/Promise\.(all|allSettled|race|any)\s*\([\s\S]*\.map\(\s*async\s/.test(nearby)) return true;

  const variableMatch = lines[index]?.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*.*\.map\(\s*async\s/);
  if (!variableMatch) return false;

  const variableName = variableMatch[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const followUp = lines.slice(index + 1, Math.min(lines.length, index + 5)).join("\n");
  return new RegExp(`Promise\\.(all|allSettled|race|any)\\s*\\(\\s*${variableName}\\s*\\)`).test(followUp);
}

function isDeadFeatureFlag(lines: string[], index: number): boolean {
  const match = lines[index]?.match(/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*(?:flag|feature|enabled|toggle|experiment|gate)[A-Za-z_$\d]*)\s*=\s*(true|false)\s*;?\s*$/i);
  if (!match) return false;
  const variableName = match[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const followUp = lines.slice(index + 1, Math.min(lines.length, index + 5)).join("\n");
  return new RegExp(`(?:if\\s*\\(\\s*!?${variableName}\\s*\\)|${variableName}\\s*\\?)`).test(followUp);
}

function isCatchWrapNoCause(lines: string[], index: number): boolean {
  const throwLine = lines[index] ?? "";
  const catchMatch = lines.slice(Math.max(0, index - 3), index).join("\n").match(/catch\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/);
  if (!catchMatch) return false;
  const errorName = catchMatch[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nearby = lines.slice(index, Math.min(lines.length, index + 3)).join("\n");
  if (new RegExp(`\\bcause\\s*:\\s*${errorName}\\b`).test(nearby)) return false;
  if (new RegExp(`\\b${errorName}\\b`).test(throwLine)) return false;
  return true;
}

function scanFileLines(filePath: string, lines: string[], rules: GrepExtendedRuleDefinition[]): Issue[] {
  const found: Issue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of rules) {
      if (!rule.pattern.test(line)) continue;
      if (isLineIgnored(line, rule.id)) continue;
      if (rule.id === "BARE_ASYNC_MAP" && isPromiseWrappedAsyncMap(lines, i)) continue;
      if (rule.id === "DEAD_FEATURE_FLAG" && !isDeadFeatureFlag(lines, i)) continue;
      if (rule.id === "CATCH_WRAP_NO_CAUSE" && !isCatchWrapNoCause(lines, i)) continue;
      if (rule.id === "FETCH_RESPONSE_CAST" && !hasNearbyFetch(lines, i)) continue;
      if (rule.id === "NUMERIC_SUFFIX" && (isTestOrScriptFile(filePath) || KNOWN_NUMERIC_SUFFIX_TERMS.test(line))) continue;
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

export function runGrepExtendedFromEntries(entries: FileEntry[], ruleFilter?: (id: string) => boolean): Issue[] {
  const issues: Issue[] = [];
  for (const entry of entries) {
    const applicableRules = ACTIVE_RULES.filter(
      (r) => (!ruleFilter || ruleFilter(r.id)) && (!r.fileFilter || r.fileFilter.test(entry.path)),
    );
    if (applicableRules.length === 0) continue;
    const found = scanFileLines(entry.path, entry.lines, applicableRules);
    issues.push(...found);
  }
  return issues;
}
