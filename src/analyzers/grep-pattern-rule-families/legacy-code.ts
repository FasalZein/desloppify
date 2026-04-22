import type { GrepPatternRuleDefinition, GrepPatternRuleDescriptions } from "./shared";

export const LEGACY_CODE_GREP_PATTERN_RULES: GrepPatternRuleDefinition[] = [
  {
    id: "TODO_REMOVE",
    pattern: /\/\/\s*(TODO|FIXME|HACK|XXX)\s*:?\s*.*(remove|delete|clean\s*up|temporary|temp\b|replace|migrate|deprecated)/i,
    category: "legacy-code",
    severity: "LOW",
    tier: 1,
    message: "TODO comment flagged for removal or migration",
    fix: "Resolve the TODO or remove it",
  },
  {
    id: "DEPRECATED_ANNOTATION",
    pattern: /^\s*(\*\s*)?@deprecated\b/,
    category: "legacy-code",
    severity: "MEDIUM",
    tier: 2,
    message: "Deprecated annotation — this code should be removed",
    fix: "Remove and update callers",
  },
  {
    id: "FIXME_HACK_XXX",
    pattern: /^\s*(\/\/|#)\s*(FIXME|HACK|XXX)\b/,
    category: "legacy-code",
    severity: "MEDIUM",
    tier: 0,
    message: "FIXME/HACK/XXX marker — known bad code left in",
  },
  {
    id: "CALLBACK_STYLE",
    pattern: /\bfs\.(readFile|writeFile|mkdir|readdir|stat|unlink|rename|access)\s*\([^)]*,\s*(function|\(err)/,
    category: "legacy-code",
    severity: "LOW",
    tier: 0,
    message: "Callback-style fs API — use fs.promises or fs/promises",
  },
];

export const LEGACY_CODE_GREP_PATTERN_DESCRIPTIONS: GrepPatternRuleDescriptions = {
  TODO_REMOVE: "TODO flagged for removal",
  DEPRECATED_ANNOTATION: "@deprecated code still present",
  FIXME_HACK_XXX: "FIXME/HACK/XXX — known bad code",
  CALLBACK_STYLE: "Callback-style API — use promises",
};
