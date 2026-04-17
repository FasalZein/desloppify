import type { Issue, Category, Severity, Tier } from "../types";
import { isLineIgnored } from "../ignore";
import type { FileEntry } from "./file-walker";

interface GrepRule {
  id: string;
  pattern: RegExp;
  category: Category;
  severity: Severity;
  tier: Tier;
  message: string;
  fix?: string;
  skipTest?: boolean; // Skip this rule in test files
}

const RULES: GrepRule[] = [
  // ai-slop: banner comments
  {
    id: "BANNER_COMMENT",
    pattern: /^[\s]*(\/\/|#)\s*[─═━─\-=]{10,}/,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "ASCII banner separator — visual noise from LLM generation",
    fix: "Remove the banner line",
  },
  // ai-slop: narration comments
  {
    id: "NARRATION_COMMENT",
    pattern: /\/\/\s*(First,?\s+(we|let's)|Now\s+(we|let's)|Next,?\s+(we|let's)|Step\s+\d+)/i,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "Process narration comment — code isn't a story",
    fix: "Remove the narration comment",
  },
  // ai-slop: apologetic comments
  {
    id: "APOLOGETIC_COMMENT",
    pattern: /\/\/\s*(Note:\s*you\s+may|Feel free to|You might want to|TODO:\s*consider)/i,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "Apologetic/suggestive comment — decide and act, don't hedge",
    fix: "Remove the comment or implement the suggestion",
  },
  // ai-slop: obvious JSX labels
  {
    id: "OBVIOUS_JSX_LABEL",
    pattern: /\{\/\*\s*(Header|Footer|Sidebar|Main content|Navigation|Content|Body|Wrapper)\s*\*\/\}/i,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "JSX comment labels the obvious — the component tag is the label",
    fix: "Remove the comment",
  },
  // legacy: TODO/FIXME with temporal references
  {
    id: "TODO_REMOVE",
    pattern: /\/\/\s*(TODO|FIXME|HACK|XXX)\s*:?\s*.*(remove|delete|clean\s*up|temporary|temp\b|replace|migrate|deprecated)/i,
    category: "legacy-code",
    severity: "LOW",
    tier: 1,
    message: "TODO comment flagged for removal or migration",
    fix: "Resolve the TODO or remove it",
  },
  // ai-slop: demo/placeholder markers
  {
    id: "DEMO_PLACEHOLDER",
    pattern: /^\s*\/\/\s*(for demo|placeholder|mock data|sample data|dummy data|fake data|wire.*real.*api|todo.*wire|todo.*replace.*real)/i,
    category: "ai-slop",
    severity: "MEDIUM",
    tier: 1,
    message: "Demo/placeholder code flagged by comment",
    fix: "Replace with real implementation or remove",
  },
  // legacy: deprecated annotations
  {
    id: "DEPRECATED_ANNOTATION",
    pattern: /^\s*(\*\s*)?@deprecated\b/,
    category: "legacy-code",
    severity: "MEDIUM",
    tier: 2,
    message: "Deprecated annotation — this code should be removed",
    fix: "Remove and update callers",
  },
  // ai-slop: hedging comments
  {
    id: "HEDGING_COMMENT",
    pattern: /(\/\/|#)\s*(this\s+)?(should work|should be fine|hopefully|might need|in theory|this may|ideally|this seems to|probably)/i,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "Hedging comment — LLM uncertainty leaked into code",
    fix: "Remove the hedging comment or fix the uncertainty",
  },
  // ai-slop: section label comments
  {
    id: "SECTION_LABEL_COMMENT",
    pattern: /^\s*(\/\/|#)\s*(Setup|Initialization|Cleanup|Teardown|Main logic|Business logic|Helper functions|Utility functions|Constants|Imports)\s*$/i,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "Section label comment — fake structure in a flat file",
    fix: "Remove or extract into a real module",
  },
  // ai-slop: instructional comments
  {
    id: "INSTRUCTIONAL_COMMENT",
    pattern: /(\/\/|#)\s*(Make sure to|Don't forget|Remember to|Be sure to|Be careful|Important:?\s+always)/i,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "Tutorial voice in production code",
    fix: "Remove the instructional comment",
  },
  // ai-slop: stated return comments
  {
    id: "STATED_RETURN_COMMENT",
    pattern: /\/\/\s*[Rr]eturn(s|ing)?\s+(the|a|an)\s+\w+/,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "Comment narrates the return value — the code already says this",
    fix: "Remove the comment",
  },
  // ai-slop: triple null guard
  {
    id: "TRIPLE_NULL_GUARD",
    pattern: /!==?\s*(null|undefined)\s*&&\s*\w+\s*!==?\s*(null|undefined)\s*&&\s*\w+\s*!==?\s*['"]/,
    category: "ai-slop",
    severity: "MEDIUM",
    tier: 2,
    message: "Triple null/undefined/empty guard — use ?? or != null",
    fix: "Simplify to a single nullish check",
  },
  // ai-slop: explicit true/false comparison
  {
    id: "EXPLICIT_TRUE_COMPARE",
    pattern: /\w\s*===?\s*(true|false)\s*[;),\]}&|?:]/,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "Redundant boolean comparison — just use the value directly",
    fix: "Remove === true or negate for === false",
  },
  // ai-slop: return undefined explicitly
  {
    id: "RETURN_UNDEFINED",
    pattern: /^\s*return\s+undefined\s*;/,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "Explicit return undefined — just return;",
    fix: "Replace with bare return;",
  },
  // ai-slop: placeholder variable names
  {
    id: "PLACEHOLDER_VAR_NAME",
    pattern: /\b(data[2-9]|result[2-9]|temp\d+|foo\d*|bar\d*|baz\d*|myVar|someVar|testData)\b\s*[=:]/,
    category: "ai-slop",
    severity: "MEDIUM",
    tier: 0,
    message: "Placeholder variable name — rename to something meaningful",
  },
  // defensive: log and rethrow
  {
    id: "LOG_AND_RETHROW",
    pattern: /console\.(error|log|warn)\s*\(/,
    category: "defensive-programming",
    severity: "HIGH",
    tier: 2,
    message: "Catch-log-rethrow adds no value — let the error propagate",
    fix: "Remove the catch block or handle the error meaningfully",
  },
  // ai-slop: lint escape
  {
    id: "LINT_ESCAPE",
    pattern: /^\s*(\/\/\s*eslint-disable|\/\*\s*eslint-disable|\/\/\s*@ts-ignore|\/\/\s*@ts-nocheck|#\s*noqa|#\s*type:\s*ignore)/,
    category: "ai-slop",
    severity: "MEDIUM",
    tier: 0,
    message: "Lint suppression — fix the underlying issue instead",
  },
  // ai-slop: entry/exit logging
  {
    id: "ENTRY_EXIT_LOG",
    pattern: /console\.(log|debug)\s*\(\s*['"`](Entering|Exiting|Called|Starting|Ending|Leaving)\b/i,
    category: "ai-slop",
    severity: "MEDIUM",
    tier: 1,
    message: "Function lifecycle logging — debugging residue",
    fix: "Remove the entry/exit log statement",
  },
  // legacy: FIXME/HACK/XXX (stronger signal than TODO)
  {
    id: "FIXME_HACK_XXX",
    pattern: /^\s*(\/\/|#)\s*(FIXME|HACK|XXX)\b/,
    category: "legacy-code",
    severity: "MEDIUM",
    tier: 0,
    message: "FIXME/HACK/XXX marker — known bad code left in",
  },
  // complexity: deeply nested callbacks
  {
    id: "DEEP_NESTING",
    pattern: /^(\s{12,}|\t{3,})(if|else|for|while|switch)\s*\(/,
    category: "complexity",
    severity: "HIGH",
    tier: 0,
    message: "Deeply nested conditional — hard to follow",
    fix: "Extract to function or use early returns",
  },
  // complexity: nested ternary chains
  {
    id: "NESTED_TERNARY",
    pattern: /\?/,
    category: "complexity",
    severity: "MEDIUM",
    tier: 0,
    message: "Nested ternary chain — use if/else for readability",
  },
  // security-slop: hardcoded secrets
  {
    id: "HARDCODED_SECRET",
    pattern: /\b(password|secret|api_key|apiKey|token|auth)\s*[:=]\s*["'][^"']{8,}["']/,
    category: "security-slop",
    severity: "CRITICAL",
    tier: 0,
    message: "Hardcoded secret — move to environment variable",
    skipTest: true,
  },
  // security-slop: hardcoded localhost/URLs
  {
    id: "HARDCODED_URL",
    pattern: /["'](https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0):\d+|https?:\/\/api\.\w+\.com)[^"']*["']/,
    category: "security-slop",
    severity: "MEDIUM",
    tier: 0,
    message: "Hardcoded URL — use environment variable or config",
  },
  // security-slop: SQL string concatenation
  {
    id: "SQL_INJECTION",
    pattern: /["'`](SELECT|INSERT|UPDATE|DELETE)\s+.*["'`]\s*\+\s*\w+/i,
    category: "security-slop",
    severity: "CRITICAL",
    tier: 0,
    message: "SQL string concatenation — use parameterized queries",
  },
  // ai-slop: commented-out code blocks (3+ lines detected via preceding comment)
  {
    id: "COMMENTED_CODE_BLOCK",
    pattern: /^\s*(\/\/|#)\s*(?:(?:const|let|var|function|class|import|export|if|for|while|return)\b|async(?:\s+function\b|\s*\())/,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "Commented-out code — delete it, git remembers",
    fix: "Remove the commented-out code block",
  },
  // ai-slop: placeholder values shipped
  {
    id: "PLACEHOLDER_VALUE",
    pattern: /["'](your-api-key-here|CHANGE_ME|TODO:\s*replace|example\.com|xxx|changeme|replace-me)["']/i,
    category: "ai-slop",
    severity: "HIGH",
    tier: 0,
    message: "Placeholder value shipped in code — replace with real value",
  },
  // inconsistency: mixed require and import
  {
    id: "MIXED_IMPORT_STYLE",
    pattern: /^const\s+\w+\s*=\s*require\s*\(/,
    category: "inconsistency",
    severity: "LOW",
    tier: 0,
    message: "require() in ESM file — use import instead",
  },
  // legacy: callback-style in promise era
  {
    id: "CALLBACK_STYLE",
    pattern: /\bfs\.(readFile|writeFile|mkdir|readdir|stat|unlink|rename|access)\s*\([^)]*,\s*(function|\(err)/,
    category: "legacy-code",
    severity: "LOW",
    tier: 0,
    message: "Callback-style fs API — use fs.promises or fs/promises",
  },
  // defensive: unchecked promise (fire and forget)
  {
    id: "UNCHECKED_PROMISE",
    pattern: /^\s*\w+\.(then|catch)\s*\(\s*\)\s*;?\s*$/,
    category: "defensive-programming",
    severity: "MEDIUM",
    tier: 0,
    message: "Empty .then()/.catch() — handle the promise result",
  },
  // ai-slop: hardcoded fake data as real analytics
  {
    id: "HARDCODED_FAKE_DATA",
    pattern: /^\s*(const|let|var)\s+\w+(Data|Items|Stats|Metrics)\s*=\s*\[$/,
    category: "ai-slop",
    severity: "HIGH",
    tier: 0,
    message: "Hardcoded data array — should come from API or props",
  },
  // ai-slop: unnecessary intermediate variable before return
  {
    id: "UNNECESSARY_INTERMEDIATE",
    pattern: /^\s*(const|let)\s+(\w+)\s*=\s*.+;\s*$/,
    category: "ai-slop",
    severity: "LOW",
    tier: 0,
    message: "Unnecessary intermediate variable — return the expression directly",
  },
  {
    id: "DEBUG_BREAKPOINT",
    pattern: /\bdebugger\b|\bbreakpoint\b|\bpdb\.set_trace\b|dbg!/, 
    category: "ai-slop",
    severity: "HIGH",
    tier: 1,
    message: "Debug breakpoint left in code — remove before shipping",
    fix: "Remove the breakpoint/debug statement",
    skipTest: true,
  },
  // ai-slop: useMemo with empty deps on a constant
  {
    id: "USEMEMO_EMPTY_DEPS",
    pattern: /useMemo\(\s*\(\)\s*=>\s*(?!\s*\{).*?,\s*\[\s*\]\s*\)/,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "useMemo with empty deps on a constant — just use the value directly",
    fix: "Remove the useMemo wrapper",
  },
  {
    id: "FAKE_LOADING_DELAY",
    pattern: /await\s+new\s+Promise\s*\(.*setTimeout\s*\(/,
    category: "ai-slop",
    severity: "MEDIUM",
    tier: 1,
    message: "Fake loading delay in production code — simulated latency should not ship",
    fix: "Remove the artificial delay or gate it to demos/tests",
    skipTest: true,
  },
  {
    id: "UNNECESSARY_USECALLBACK",
    pattern: /useCallback\(\s*\(\)\s*=>.*\[\s*\]\s*\)/,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "useCallback with empty deps and no captured values — use the function directly",
    fix: "Remove the useCallback wrapper",
  },
  {
    id: "REDUNDANT_BOOLEAN_RETURN",
    pattern: /^\s*if\s*\(.+\)/,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "Redundant boolean-return scaffolding — return the condition directly",
    fix: "Replace the if/else boolean return with a direct return",
  },
  // ai-slop: ghost state wired to disabled controls
  {
    id: "UNDERSCORE_STATE",
    pattern: /\[\s*_\w+\s*,\s*set\w+\s*\]\s*=\s*useState/,
    category: "ai-slop",
    severity: "MEDIUM",
    tier: 0,
    message: "Underscore-prefixed state variable — likely unused dead state",
  },
  // complexity: boolean flag parameters (3+)
  {
    id: "BOOLEAN_FLAG_PARAMS",
    pattern: /\w+\s*:\s*boolean\s*[,)=].*\w+\s*:\s*boolean\s*[,)=].*\w+\s*:\s*boolean/,
    category: "complexity",
    severity: "MEDIUM",
    tier: 0,
    message: "3+ boolean parameters — use an options object or separate functions",
  },
  // ai-slop: redundant type cast on already-typed value
  {
    id: "REDUNDANT_CAST",
    pattern: /\b(String|Number|Boolean)\(\s*\w+\s*\)\s*$/,
    category: "ai-slop",
    severity: "LOW",
    tier: 0,
    message: "Possibly redundant type cast — check if value is already the right type",
  },
  // duplication: key={index} when mapping (only in JSX files)
  {
    id: "KEY_INDEX",
    pattern: /^\s*<\w[\w.]*\s+.*key=\{(index|i|idx)\}/,
    category: "ai-slop",
    severity: "LOW",
    tier: 0,
    message: "Using array index as React key — use a stable ID if available",
  },
  // security-slop: client-generated ID for server data
  {
    id: "CLIENT_GENERATED_ID",
    pattern: /`\w+_\$\{Date\.now\(\)\}_\$\{Math\.random\(\)/,
    category: "security-slop",
    severity: "MEDIUM",
    tier: 0,
    message: "Client-generated ID — let the server generate IDs for persisted records",
  },
  // ai-slop: defensive or-cascade
  {
    id: "OR_CASCADE",
    pattern: /\.get\(\s*["']\w+["']\s*\)\s*(or|\|\|)\s*\S+.*\.get\(\s*["']\w+["']\s*\)\s*(or|\|\|)/,
    category: "ai-slop",
    severity: "LOW",
    tier: 0,
    message: "Chained defensive .get() or fallbacks — simplify the data model",
  },
];

const TEST_FILE = /\.(test|spec|mock|fixture)\.(ts|tsx|js|jsx|py)$|__tests__|tests\/|test_/;
const KNOWN_NUMERIC_SUFFIX_TERMS = /\b\w*(?:bm25|md5|sha(?:1|224|256|384|512)|base64|http[23]|ipv[46]|oauth2|x(?:86|64)|utf(?:8|16|32)|argon2|pbkdf2|ripemd160|hmac256|blake2[bs]?|chacha20|aes(?:128|192|256))\b/i;

function nextMeaningfulLine(lines: string[], start: number): { index: number; text: string } | null {
  for (let i = start; i < lines.length; i++) {
    const text = lines[i].trim();
    if (!text) continue;
    return { index: i, text };
  }
  return null;
}

function previousMeaningfulLine(lines: string[], start: number): { index: number; text: string } | null {
  for (let i = start; i >= 0; i--) {
    const text = lines[i].trim();
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
  const line = lines[index].trim();
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

function scanFileLines(filePath: string, lines: string[], isTestFile: boolean): Issue[] {
  const found: Issue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] ?? "";
    for (const rule of RULES) {
      if (rule.skipTest && isTestFile) continue;
      if (!rule.pattern.test(line)) continue;
      if (isLineIgnored(line, rule.id)) continue;
      if (rule.id === "DEBUG_BREAKPOINT" && /(pattern:\s*\/|desc:\s*"|message:\s*"|fix:\s*"|DEBUG_BREAKPOINT:)/.test(line)) continue;
      if (rule.id === "BANNER_COMMENT" && isDecorativeBannerBlock(lines, i)) continue;
      if (rule.id === "UNNECESSARY_USECALLBACK" && /pattern:\s*\//.test(line)) continue;
      if (rule.id === "NESTED_TERNARY" && (/\/.*\?[:?]/.test(line) || !hasNestedTernary(line))) continue;
      if (rule.id === "LOG_AND_RETHROW" && !isCatchLogAndRethrow(lines, i)) continue;
      if (rule.id === "UNNECESSARY_INTERMEDIATE") {
        const match = line.match(/^\s*(const|let)\s+(\w+)\s*=\s*.+;\s*$/);
        if (!match || nextLine.trim() !== `return ${match[2]};`) continue;
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

export function runGrepPatternsFromEntries(entries: FileEntry[]): Issue[] {
  const issues: Issue[] = [];
  for (const entry of entries) {
    const found = scanFileLines(entry.path, entry.lines, TEST_FILE.test(entry.path));
    issues.push(...found);
  }
  return issues;
}
