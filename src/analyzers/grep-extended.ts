import type { Issue, Category, Severity, Tier } from "../types";
import { isLineIgnored } from "../ignore";
import type { FileEntry } from "./file-walker";

/**
 * Extended grep rules for new categories:
 * - test-quality: empty tests, weak assertions, sleepy tests
 * - async-correctness: floating promises, forEach async, blocking in async
 * - runtime-validation: unvalidated req.body, type-cast external data
 * - accessibility: interactive divs, missing aria-labels, missing alt
 * - naming-semantics: abstract names, numeric suffixes, generic bucket files
 */

interface GrepRule {
  id: string;
  pattern: RegExp;
  category: Category;
  severity: Severity;
  tier: Tier;
  message: string;
  fix?: string;
  fileFilter?: RegExp; // Only run on matching files
}

const RULES: GrepRule[] = [
  // ── test-quality ────────────────────────────────────────────
  {
    id: "EMPTY_TEST",
    pattern: /^\s*(it|test)\s*\(\s*['"][^'"]+['"]\s*,\s*(\(\)|async\s*\(\))\s*=>\s*\{\s*\}\s*\)/,
    category: "test-quality",
    severity: "HIGH",
    tier: 0,
    message: "Empty test body — test passes but checks nothing",
    fileFilter: /\.(test|spec)\.(ts|tsx|js|jsx)$/,
  },
  {
    id: "WEAK_ASSERTION",
    pattern: /expect\([^)]+\)\.(toBeTruthy|toBeDefined|not\.toBeNull|not\.toBeUndefined)\(\)/,
    category: "test-quality",
    severity: "MEDIUM",
    tier: 0,
    message: "Weak assertion — tests existence not correctness. Assert on the actual value.",
    fileFilter: /\.(test|spec)\.(ts|tsx|js|jsx)$/,
  },
  {
    id: "ASSERT_TRUE",
    pattern: /\b(assert\s+True|assertTrue\(true|expect\(true\)\.toBe\(true\))/,
    category: "test-quality",
    severity: "HIGH",
    tier: 0,
    message: "Tautological assertion — always passes, tests nothing",
    fileFilter: /\.(test|spec)\.(ts|tsx|js|jsx|py)$/,
  },
  {
    id: "SLEEPY_TEST",
    pattern: /\b(setTimeout|sleep|await\s+delay|await\s+new\s+Promise.*setTimeout)\s*\(/,
    category: "test-quality",
    severity: "MEDIUM",
    tier: 0,
    message: "Sleep in test — use waitFor/polling instead of arbitrary delays",
    fileFilter: /\.(test|spec)\.(ts|tsx|js|jsx)$/,
  },
  {
    id: "SKIPPED_TEST",
    pattern: /\b(it\.skip|test\.skip|xit|xdescribe|xtest|@pytest\.mark\.skip|@unittest\.skip)/,
    category: "test-quality",
    severity: "LOW",
    tier: 0,
    message: "Skipped test — resolve or remove, don't leave disabled tests",
    fileFilter: /\.(test|spec)\.(ts|tsx|js|jsx|py)$/,
  },
  {
    id: "SNAPSHOT_OVERUSE",
    pattern: /toMatchSnapshot\(\)|toMatchInlineSnapshot\(/,
    category: "test-quality",
    severity: "LOW",
    tier: 0,
    message: "Snapshot test — brittle, breaks on any change. Assert on specific values.",
    fileFilter: /\.(test|spec)\.(ts|tsx|js|jsx)$/,
  },

  // ── async-correctness ──────────────────────────────────────
  {
    id: "FOREACH_ASYNC",
    pattern: /\.forEach\(\s*async\s/,
    category: "async-correctness",
    severity: "CRITICAL",
    tier: 0,
    message: "async callback in forEach — promises are fire-and-forgotten. Use for...of or Promise.all(map()).",
  },
  {
    id: "ASYNC_PROMISE_EXECUTOR",
    pattern: /new\s+Promise\s*\(\s*async\s*\(/,
    category: "async-correctness",
    severity: "HIGH",
    tier: 0,
    message: "async Promise executor — use a plain async function or non-async executor with explicit resolve/reject",
  },
  {
    id: "USEEFFECT_ASYNC",
    pattern: /useEffect\(\s*async\s*\(/,
    category: "async-correctness",
    severity: "HIGH",
    tier: 0,
    message: "async useEffect callback — wrap the async work in an inner function instead",
    fileFilter: /\.(tsx|jsx)$/,
  },
  {
    id: "REDUNDANT_RETURN_AWAIT",
    pattern: /return\s+await\s+\w+\(/,
    category: "async-correctness",
    severity: "LOW",
    tier: 0,
    message: "return await on a direct promise — return the promise unless you need try/catch semantics",
  },
  {
    id: "BARE_ASYNC_MAP",
    pattern: /\.map\(\s*async\s/,
    category: "async-correctness",
    severity: "HIGH",
    tier: 0,
    message: "async map result not obviously awaited — collect with Promise.all(...) or use for...of",
  },
  // PROMISE_IN_VOID removed — too noisy without type info
  {
    id: "REQUESTS_IN_ASYNC",
    pattern: /^\s*(response|r|res)\s*=\s*(requests\.(get|post|put|patch|delete))/,
    category: "async-correctness",
    severity: "CRITICAL",
    tier: 0,
    message: "Blocking requests.get/post in async context — use httpx.AsyncClient instead",
    fileFilter: /\.py$/,
  },
  {
    id: "SEQUENTIAL_AWAIT",
    pattern: /await\s+\w+\([^)]*\)\s*;\s*\n\s*(?:const|let|var)\s+\w+\s*=\s*await\s+\w+\(/,
    category: "async-correctness",
    severity: "MEDIUM",
    tier: 0,
    message: "Sequential awaits — if independent, use Promise.all() for parallel execution",
  },
  {
    id: "CALLBACK_PROMISE_MIX",
    pattern: /(?:^|[^/'"`])\.then\(\s*(?:async\b|(?:\([^)]*\)|\w+)\s*=>.*await\b)/,
    category: "async-correctness",
    severity: "MEDIUM",
    tier: 0,
    message: "Mixing .then() with async/await — pick one style",
  },
  {
    id: "JSON_DEEP_CLONE",
    pattern: /JSON\.parse\(\s*JSON\.stringify\(/,
    category: "ai-slop",
    severity: "MEDIUM",
    tier: 0,
    message: "JSON stringify/parse deep clone — lossy and slow. Use structuredClone when available.",
  },
  {
    id: "HANDWAVY_COMMENT",
    pattern: /^\s*(\/\/|#)\s*(quick fix|temporary workaround|works for now|good enough|safe enough|hacky|dirty)\b/i,
    category: "ai-slop",
    severity: "LOW",
    tier: 1,
    message: "Handwavy comment — vague workaround language leaked into code",
    fileFilter: /\.(ts|tsx|js|jsx)$/,
  },
  {
    id: "NOT_IMPLEMENTED_STUB",
    pattern: /throw\s+new\s+Error\s*\(\s*["'`](todo|not implemented|unimplemented|stub|implement me|placeholder)["'`]\s*\)/i,
    category: "ai-slop",
    severity: "MEDIUM",
    tier: 1,
    message: "Not-implemented stub shipped in JS/TS code",
    fix: "Implement the function or replace the placeholder stub",
    fileFilter: /\.(ts|tsx|js|jsx)$/,
  },
  {
    id: "DEAD_FEATURE_FLAG",
    pattern: /^\s*(?:export\s+)?(?:const|let|var)\s+[A-Za-z_$][\w$]*(?:flag|feature|enabled|toggle|experiment|gate)[A-Za-z_$\d]*\s*=\s*(true|false)\s*;?\s*$/i,
    category: "legacy-code",
    severity: "MEDIUM",
    tier: 0,
    message: "Feature flag always on/off — remove the dead branch or make it real configuration",
    fileFilter: /\.(ts|tsx|js|jsx)$/,
  },
  {
    id: "THROW_NON_ERROR",
    pattern: /^\s*throw\s+(?:["'`]|\{|\[|\d|true\b|false\b|null\b|undefined\b)/,
    category: "defensive-programming",
    severity: "HIGH",
    tier: 0,
    message: "Thrown value is not an Error instance — throw Error objects for stack/cause semantics",
    fileFilter: /\.(ts|tsx|js|jsx)$/,
  },
  {
    id: "CATCH_WRAP_NO_CAUSE",
    pattern: /^\s*throw\s+new\s+(?:Error|TypeError|RangeError|ReferenceError|SyntaxError|URIError|EvalError|AggregateError)\s*\(/,
    category: "defensive-programming",
    severity: "MEDIUM",
    tier: 0,
    message: "Catch block wraps an error without preserving the original cause",
    fileFilter: /\.(ts|tsx|js|jsx)$/,
  },

  // ── runtime-validation ─────────────────────────────────────
  {
    id: "UNVALIDATED_BODY",
    pattern: /(?:req|request)\.body\s*(as\s+\w|:\s*\w)/,
    category: "runtime-validation",
    severity: "CRITICAL",
    tier: 0,
    message: "req.body type-cast without runtime validation — TypeScript types are erased at runtime. Use Zod/Yup/Joi.",
  },
  {
    id: "JSON_PARSE_CAST",
    pattern: /JSON\.parse\([^)]+\)\s*as\s+\w/,
    category: "runtime-validation",
    severity: "HIGH",
    tier: 0,
    message: "JSON.parse cast to type without validation — parse result is unknown at runtime",
  },
  {
    id: "FETCH_RESPONSE_CAST",
    pattern: /\.json\(\)\s*(as\s+\w|<\w)/,
    category: "runtime-validation",
    severity: "HIGH",
    tier: 0,
    message: "Fetch response cast without validation — API responses need runtime schema checks",
  },
  {
    id: "LOCALSTORAGE_CAST",
    pattern: /localStorage\.getItem\([^)]+\)\s*(as\s+\w|!)/,
    category: "runtime-validation",
    severity: "MEDIUM",
    tier: 0,
    message: "localStorage value cast without validation — user-controlled data needs parsing",
  },

  // ── accessibility ──────────────────────────────────────────
  {
    id: "INTERACTIVE_DIV",
    pattern: /<div[^>]*\sonClick/,
    category: "accessibility",
    severity: "HIGH",
    tier: 0,
    message: "onClick on <div> — use <button> for interactive elements (keyboard/screen reader accessible)",
    fix: "Replace <div onClick> with <button onClick>",
    fileFilter: /\.(tsx|jsx)$/,
  },
  {
    id: "INTERACTIVE_SPAN",
    pattern: /<span[^>]*\sonClick/,
    category: "accessibility",
    severity: "HIGH",
    tier: 0,
    message: "onClick on <span> — use <button> or <a> for interactive elements",
    fix: "Replace <span onClick> with <button onClick>",
    fileFilter: /\.(tsx|jsx)$/,
  },
  {
    id: "IMG_NO_ALT",
    pattern: /<img\s[^>]*(?!.*\balt\b)[^>]*>/,
    category: "accessibility",
    severity: "HIGH",
    tier: 0,
    message: "Image without alt attribute — WCAG Level A violation",
    fix: "Add a descriptive alt attribute",
    fileFilter: /\.(tsx|jsx|html)$/,
  },
  {
    id: "MEANINGLESS_ALT",
    pattern: /alt=["'](image|photo|pic|img|icon|logo|picture|banner|figure)["']/i,
    category: "accessibility",
    severity: "MEDIUM",
    tier: 0,
    message: "Meaningless alt text — describe what the image shows, not what it is",
    fix: "Replace with descriptive alt text",
    fileFilter: /\.(tsx|jsx|html)$/,
  },
  {
    id: "INPUT_NO_LABEL",
    pattern: /<input[^>]*placeholder[^>]*(?!.*aria-label)(?!.*aria-labelledby)[^>]*\/?\s*>/,
    category: "accessibility",
    severity: "MEDIUM",
    tier: 0,
    message: "Input with placeholder but no label — placeholders are not labels",
    fix: "Add <label htmlFor> or aria-label",
    fileFilter: /\.(tsx|jsx|html)$/,
  },

  // ── naming-semantics ───────────────────────────────────────
  {
    id: "NUMERIC_SUFFIX",
    pattern: /\b(const|let|var|function)\s+\w+[2-9]\s*[=(:]/,
    category: "naming-semantics",
    severity: "MEDIUM",
    tier: 0,
    message: "Numeric suffix in identifier — rename to describe what's different",
  },
  {
    id: "GENERIC_BUCKET_FILE",
    pattern: /^$/,  // Placeholder — detected in file-metrics instead
    category: "naming-semantics",
    severity: "MEDIUM",
    tier: 0,
    message: "Generic bucket file — split into domain-specific modules",
  },
  {
    id: "EVAL_EXEC",
    pattern: /^\s*\w*\s*=?\s*\b(eval|exec)\s*\(/,
    category: "security-slop",
    severity: "CRITICAL",
    tier: 0,
    message: "eval()/exec() — arbitrary code execution. Use a safe parser instead.",
  },
  {
    id: "PICKLE_LOADS",
    pattern: /pickle\.(loads?|Unpickler)\s*\(/,
    category: "security-slop",
    severity: "CRITICAL",
    tier: 0,
    message: "pickle.load on potentially untrusted data — use json or a safe serializer",
    fileFilter: /\.py$/,
  },

  // ── Python-specific ────────────────────────────────────────
  {
    id: "MUTABLE_DEFAULT",
    pattern: /def\s+\w+\([^)]*=\s*(\[\]|\{\}|set\(\))/,
    category: "defensive-programming",
    severity: "HIGH",
    tier: 0,
    message: "Mutable default argument — shared across all calls. Use None and create inside.",
    fix: "Use None as default, create mutable object inside function body",
    fileFilter: /\.py$/,
  },
  {
    id: "BUILTIN_SHADOW",
    pattern: /\b(list|dict|set|map|filter|range|zip|all|any|sum|min|max|len|open|print|next|iter|super)\s*=\s/,
    category: "naming-semantics",
    severity: "MEDIUM",
    tier: 0,
    message: "Variable shadows Python builtin — use a more specific name",
    fileFilter: /\.py$/,
  },
  {
    id: "ITERROWS",
    pattern: /\.iterrows\(\)/,
    category: "complexity",
    severity: "MEDIUM",
    tier: 0,
    message: "pandas iterrows() is 100-1000x slower than vectorized operations",
    fix: "Use vectorized column operations or .apply()",
    fileFilter: /\.py$/,
  },

  // ── React/frontend patterns ────────────────────────────────
  {
    id: "FULL_LODASH_IMPORT",
    pattern: /import\s+_\s+from\s+['"]lodash['"]/,
    category: "complexity",
    severity: "HIGH",
    tier: 0,
    message: "Full lodash import adds ~70KB gzipped — import specific functions: lodash/debounce",
    fix: "import debounce from 'lodash/debounce'",
    fileFilter: /\.(ts|tsx|js|jsx)$/,
  },
  {
    id: "MOMENT_IMPORT",
    pattern: /import\s+moment\s+from\s+['"]moment['"]/,
    category: "legacy-code",
    severity: "MEDIUM",
    tier: 0,
    message: "moment.js is deprecated and 300KB — use date-fns, dayjs, or Temporal",
    fix: "Replace with date-fns or dayjs",
    fileFilter: /\.(ts|tsx|js|jsx)$/,
  },
  {
    id: "TAILWIND_HARDCODED_COLOR",
    pattern: /className="[^"]*\[#[0-9a-fA-F]{3,8}\]/,
    category: "inconsistency",
    severity: "LOW",
    tier: 0,
    message: "Hardcoded hex color in Tailwind — use design tokens or theme colors",
    fileFilter: /\.(tsx|jsx)$/,
  },
  {
    id: "INLINE_STYLE",
    pattern: /style=\{\{[^}]*(color|background|margin|padding|fontSize|fontWeight|border)/,
    category: "inconsistency",
    severity: "LOW",
    tier: 0,
    message: "Inline style for layout/color — use CSS classes or Tailwind utilities",
    fileFilter: /\.(tsx|jsx)$/,
  },
  {
    id: "MANY_USESTATE",
    pattern: /useState/,  // Counted per-file in file-metrics instead
    category: "complexity",
    severity: "MEDIUM",
    tier: 0,
    message: "Component may have too many useState calls — consider useReducer or extracting logic",
    fileFilter: /^$/, // Disabled — handled by file-metrics counter
  },
];

// Remove placeholder/disabled rules
const ACTIVE_RULES = RULES.filter((r) => r.pattern.source !== "^$");
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

function scanFileLines(filePath: string, lines: string[], rules: GrepRule[]): Issue[] {
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
      (r) => (!ruleFilter || ruleFilter(r.id)) && (!r.fileFilter || r.fileFilter.test(entry.path))
    );
    if (applicableRules.length === 0) continue;
    const found = scanFileLines(entry.path, entry.lines, applicableRules);
    issues.push(...found);
  }
  return issues;
}
