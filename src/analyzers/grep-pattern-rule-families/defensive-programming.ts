import type { GrepPatternRuleDefinition, GrepPatternRuleDescriptions } from "./shared";

export const DEFENSIVE_PROGRAMMING_GREP_PATTERN_RULES: GrepPatternRuleDefinition[] = [
  {
    id: "LOG_AND_RETHROW",
    pattern: /console\.(error|log|warn)\s*\(/,
    category: "defensive-programming",
    severity: "HIGH",
    tier: 2,
    message: "Catch-log-rethrow adds no value — let the error propagate",
    fix: "Remove the catch block or handle the error meaningfully",
  },
  {
    id: "UNCHECKED_PROMISE",
    pattern: /^\s*\w+\.(then|catch)\s*\(\s*\)\s*;?\s*$/,
    category: "defensive-programming",
    severity: "MEDIUM",
    tier: 0,
    message: "Empty .then()/.catch() — handle the promise result",
  },
  {
    id: "EMPTY_ARRAY_FALLBACK",
    pattern: /(?:return\s+|=\s*).*(\?\?|\|\|)\s*\[\s*\]/,
    category: "defensive-programming",
    severity: "LOW",
    tier: 0,
    message: "Empty array fallback hides missing invariant — fix the source shape instead",
  },
  {
    id: "EMPTY_OBJECT_FALLBACK",
    pattern: /(?:return\s+|=\s*).*(\?\?|\|\|)\s*\{\s*\}/,
    category: "defensive-programming",
    severity: "LOW",
    tier: 0,
    message: "Empty object fallback hides missing invariant — fix the source shape instead",
  },
  {
    id: "NOOP_LAMBDA_FALLBACK",
    pattern: /(\?\?|\|\|)\s*\(?\s*(\(\s*\)\s*=>\s*\{\s*\}|function\s*\([^)]*\)\s*\{\s*\})\s*\)?/,
    category: "defensive-programming",
    severity: "MEDIUM",
    tier: 0,
    message: "No-op callback fallback hides a missing handler — make the callback required or branch explicitly",
  },
  {
    id: "PROMISE_RESOLVE_FALLBACK",
    pattern: /return\s+Promise\.resolve\(\s*(\[\s*\]|\{\s*\}|null|undefined)\s*\)/,
    category: "defensive-programming",
    severity: "MEDIUM",
    tier: 0,
    message: "Promise.resolve fallback masks missing data as success — handle the absence explicitly",
  },
];

export const DEFENSIVE_PROGRAMMING_GREP_PATTERN_DESCRIPTIONS: GrepPatternRuleDescriptions = {
  LOG_AND_RETHROW: "Catch-log-rethrow adds no value",
  UNCHECKED_PROMISE: "Empty .then()/.catch()",
  EMPTY_ARRAY_FALLBACK: "Fallback to [] hides a missing invariant",
  EMPTY_OBJECT_FALLBACK: "Fallback to {} hides a missing invariant",
  NOOP_LAMBDA_FALLBACK: "Fallback to a no-op callback hides a missing handler",
  PROMISE_RESOLVE_FALLBACK: "Promise.resolve fallback hides absence as success",
};
