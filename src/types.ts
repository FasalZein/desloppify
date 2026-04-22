import type { PackName } from "./domain/pack-catalog";

export type { PackName } from "./domain/pack-catalog";

export interface PackSelection {
  name: PackName;
  explicit: boolean;
}

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
  column?: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  fix?: string;
  tool: string;
  scoreWeight?: number;
  deltaIdentity?: string;
}

export interface ToolStatus {
  [key: string]: boolean | undefined;
  knip: boolean;
  madge: boolean;
  "ast-grep": boolean;
  tsc: boolean;
  eslint: boolean;
  biome: boolean;
  oxlint?: boolean;
  oxfmt?: boolean;
  ruff?: boolean;
  mypy?: boolean;
  vulture?: boolean;
  "cargo-clippy"?: boolean;
  staticcheck?: boolean;
  "golangci-lint"?: boolean;
  rubocop?: boolean;
}

export interface CategorySummary {
  count: number;
  fixable: number;
}

export interface RuleDefinition {
  id: string;
  name: string;
  category: Category;
  defaultSeverity: Severity;
  tool: string;
  shortDescription: string;
}

export interface FindingPosition {
  line: number;
  column: number;
}

export interface FindingLocation {
  path: string;
  range: {
    start: FindingPosition;
    end: FindingPosition;
  };
}

export interface FindingFix {
  description: string;
}

export interface Finding {
  id: string;
  rule_id: string;
  level: "error" | "warning" | "note";
  severity: Severity;
  category: Category;
  message: string;
  tool: string;
  locations: FindingLocation[];
  primary_location_index: number;
  fingerprints: {
    primary: string;
    partial?: Record<string, string>;
  };
  fixes?: FindingFix[];
  metadata?: Record<string, unknown>;
}

export interface ScanMetricSummary {
  fileCount: number;
  lineCount: number;
  nonEmptyLineCount: number;
  normalized: {
    scorePerFile: number | null;
    scorePerKloc: number | null;
    findingsPerFile: number | null;
    findingsPerKloc: number | null;
  };
}

export interface PathHotspot {
  path: string;
  findingCount: number;
  penalty: number;
}

export interface ScanReport {
  schema_version: string;
  scan: {
    version: string;
    path: string;
    generatedAt: string;
    pack: PackSelection;
  };
  architecture?: {
    profile: string;
    fitScore: number;
    violations: Record<string, number>;
    exemptionsApplied: readonly string[];
  };
  tools: ToolStatus;
  score: number;
  metrics: ScanMetricSummary;
  hotspots: {
    paths: PathHotspot[];
  };
  summary: { critical: number; high: number; medium: number; low: number };
  categories: Partial<Record<Category, CategorySummary>>;
  rules: Record<string, RuleDefinition>;
  findings: Finding[];
}
