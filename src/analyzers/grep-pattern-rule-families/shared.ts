import type { Category, Severity, Tier } from "../../types";

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

export type GrepPatternRuleDescriptions = Record<string, string>;
