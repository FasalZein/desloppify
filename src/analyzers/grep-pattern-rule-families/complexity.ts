import type { GrepPatternRuleDefinition, GrepPatternRuleDescriptions } from "./shared";

export const COMPLEXITY_GREP_PATTERN_RULES: GrepPatternRuleDefinition[] = [
  {
    id: "DEEP_NESTING",
    pattern: /^(\s{12,}|\t{3,})(if|else|for|while|switch)\s*\(/,
    category: "complexity",
    severity: "HIGH",
    tier: 0,
    message: "Deeply nested conditional — hard to follow",
    fix: "Extract to function or use early returns",
  },
  {
    id: "NESTED_TERNARY",
    pattern: /\?/,
    category: "complexity",
    severity: "MEDIUM",
    tier: 0,
    message: "Nested ternary chain — use if/else for readability",
  },
  {
    id: "BOOLEAN_FLAG_PARAMS",
    pattern: /\w+\s*:\s*boolean\s*[,)=].*\w+\s*:\s*boolean\s*[,)=].*\w+\s*:\s*boolean/,
    category: "complexity",
    severity: "MEDIUM",
    tier: 0,
    message: "3+ boolean parameters — use an options object or separate functions",
  },
];

export const COMPLEXITY_GREP_PATTERN_DESCRIPTIONS: GrepPatternRuleDescriptions = {
  DEEP_NESTING: "Conditional nesting 3+ levels",
  NESTED_TERNARY: "Nested ternary chain",
  BOOLEAN_FLAG_PARAMS: "3+ boolean parameters — use options object",
};
