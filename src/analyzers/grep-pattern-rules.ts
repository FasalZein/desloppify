import type { Category, Severity, Tier } from "../types";

export interface GrepPatternRuleDefinition {
  id: string;
  pattern: RegExp;
  category: Category;
  severity: Severity;
  tier: Tier;
  message: string;
  fix?: string;
  skipTest?: boolean;
}

export const GREP_PATTERN_RULES: GrepPatternRuleDefinition[] = [
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
  // defensive: empty array fallback hides missing invariant
  {
    id: "EMPTY_ARRAY_FALLBACK",
    pattern: /(?:return\s+|=\s*).*(\?\?|\|\|)\s*\[\s*\]/,
    category: "defensive-programming",
    severity: "LOW",
    tier: 0,
    message: "Empty array fallback hides missing invariant — fix the source shape instead",
  },
  // defensive: empty object fallback hides missing invariant
  {
    id: "EMPTY_OBJECT_FALLBACK",
    pattern: /(?:return\s+|=\s*).*(\?\?|\|\|)\s*\{\s*\}/,
    category: "defensive-programming",
    severity: "LOW",
    tier: 0,
    message: "Empty object fallback hides missing invariant — fix the source shape instead",
  },
  // defensive: noop callback fallback hides missing handler
  {
    id: "NOOP_LAMBDA_FALLBACK",
    pattern: /(\?\?|\|\|)\s*\(?\s*(\(\s*\)\s*=>\s*\{\s*\}|function\s*\([^)]*\)\s*\{\s*\})\s*\)?/,
    category: "defensive-programming",
    severity: "MEDIUM",
    tier: 0,
    message: "No-op callback fallback hides a missing handler — make the callback required or branch explicitly",
  },
  // defensive: promise-resolved empty fallback masks absence as success
  {
    id: "PROMISE_RESOLVE_FALLBACK",
    pattern: /return\s+Promise\.resolve\(\s*(\[\s*\]|\{\s*\}|null|undefined)\s*\)/,
    category: "defensive-programming",
    severity: "MEDIUM",
    tier: 0,
    message: "Promise.resolve fallback masks missing data as success — handle the absence explicitly",
  },
];

const GREP_PATTERN_RULE_DESCRIPTIONS: Record<string, string> = {
  BANNER_COMMENT: "ASCII banner separator",
  NARRATION_COMMENT: "Process narration comment",
  APOLOGETIC_COMMENT: "Apologetic/suggestive comment",
  OBVIOUS_JSX_LABEL: "JSX comment restating the tag name",
  TODO_REMOVE: "TODO flagged for removal",
  DEMO_PLACEHOLDER: "Demo/placeholder/mock data marker",
  DEPRECATED_ANNOTATION: "@deprecated code still present",
  HEDGING_COMMENT: "Uncertainty hedging — 'should work', 'hopefully'",
  SECTION_LABEL_COMMENT: "Section label in flat file — // Setup, // Cleanup",
  INSTRUCTIONAL_COMMENT: "Tutorial voice — 'Make sure to', 'Don't forget'",
  STATED_RETURN_COMMENT: "Comment narrates the return value",
  TRIPLE_NULL_GUARD: "Triple null/undefined/empty guard",
  EXPLICIT_TRUE_COMPARE: "Redundant === true/false comparison",
  RETURN_UNDEFINED: "Explicit return undefined — just return;",
  PLACEHOLDER_VAR_NAME: "Meaningless variable name — data2, temp1, foo",
  LOG_AND_RETHROW: "Catch-log-rethrow adds no value",
  LINT_ESCAPE: "Lint suppression instead of fixing the issue",
  ENTRY_EXIT_LOG: "Function entry/exit debugging log",
  FIXME_HACK_XXX: "FIXME/HACK/XXX — known bad code",
  DEEP_NESTING: "Conditional nesting 3+ levels",
  NESTED_TERNARY: "Nested ternary chain",
  HARDCODED_SECRET: "Hardcoded password/secret/key/token",
  HARDCODED_URL: "Hardcoded localhost or API URL",
  SQL_INJECTION: "SQL string concatenation — use params",
  COMMENTED_CODE_BLOCK: "Commented-out code line",
  PLACEHOLDER_VALUE: "Placeholder value shipped in code",
  MIXED_IMPORT_STYLE: "require() in ESM — use import",
  CALLBACK_STYLE: "Callback-style API — use promises",
  UNCHECKED_PROMISE: "Empty .then()/.catch()",
  HARDCODED_FAKE_DATA: "Hardcoded data array — should come from API",
  UNNECESSARY_INTERMEDIATE: "Unnecessary intermediate variable before return",
  DEBUG_BREAKPOINT: "debugger/breakpoint/pdb.set_trace/dbg! left in code",
  USEMEMO_EMPTY_DEPS: "useMemo with empty deps on constant",
  FAKE_LOADING_DELAY: "Artificial loading delay shipped in production code",
  UNNECESSARY_USECALLBACK: "useCallback with empty deps and no captures",
  REDUNDANT_BOOLEAN_RETURN: "if/else returns boolean literals — return condition directly",
  UNDERSCORE_STATE: "Underscore-prefixed useState — dead state",
  BOOLEAN_FLAG_PARAMS: "3+ boolean parameters — use options object",
  REDUNDANT_CAST: "Possibly redundant String/Number/Boolean cast",
  KEY_INDEX: "Array index as React key — use stable ID",
  CLIENT_GENERATED_ID: "Client-generated ID for server records",
  OR_CASCADE: "Chained defensive .get() or fallbacks",
  EMPTY_ARRAY_FALLBACK: "Fallback to [] hides a missing invariant",
  EMPTY_OBJECT_FALLBACK: "Fallback to {} hides a missing invariant",
  NOOP_LAMBDA_FALLBACK: "Fallback to a no-op callback hides a missing handler",
  PROMISE_RESOLVE_FALLBACK: "Promise.resolve fallback hides absence as success",
};

export const GREP_PATTERN_RULE_CATALOG = GREP_PATTERN_RULES.map(({ id, category, tier }) => ({
  id,
  category,
  tier,
  tool: "grep" as const,
  desc: GREP_PATTERN_RULE_DESCRIPTIONS[id] ?? id.toLowerCase().replace(/_/g, " "),
}));
