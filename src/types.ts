export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type Tier = 1 | 2 | 3 | 0; // 0 = flag-only

export type Category =
  | "dead-code"
  | "weak-types"
  | "ai-slop"
  | "circular-deps"
  | "duplication"
  | "defensive-programming"
  | "legacy-code"
  | "type-fragmentation"
  | "inconsistency"
  | "complexity"
  | "security-slop"
  | "test-quality"
  | "async-correctness"
  | "runtime-validation"
  | "accessibility"
  | "naming-semantics";

export interface Issue {
  id: string;
  category: Category;
  severity: Severity;
  tier: Tier;
  file: string;
  line: number;
  message: string;
  fix?: string;
  tool: string;
}

export interface ToolStatus {
  knip: boolean;
  madge: boolean;
  "ast-grep": boolean;
  tsc: boolean;
  eslint: boolean;
  biome: boolean;
}

export interface CategorySummary {
  count: number;
  fixable: number;
}

export interface ScanReport {
  version: string;
  path: string;
  architecture?: {
    profile: string;
    fitScore: number;
    violations: Record<string, number>;
    exemptionsApplied: string[];
  };
  tools: ToolStatus;
  score: number;
  summary: { critical: number; high: number; medium: number; low: number };
  categories: Partial<Record<Category, CategorySummary>>;
  issues: Issue[];
}
