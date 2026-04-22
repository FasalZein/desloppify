import type { GrepPatternRuleDefinition, GrepPatternRuleDescriptions } from "./shared";

export const INCONSISTENCY_GREP_PATTERN_RULES: GrepPatternRuleDefinition[] = [
  {
    id: "MIXED_IMPORT_STYLE",
    pattern: /^const\s+\w+\s*=\s*require\s*\(/,
    category: "inconsistency",
    severity: "LOW",
    tier: 0,
    message: "require() in ESM file — use import instead",
  },
];

export const INCONSISTENCY_GREP_PATTERN_DESCRIPTIONS: GrepPatternRuleDescriptions = {
  MIXED_IMPORT_STYLE: "require() in ESM — use import",
};
