import { createHash } from "node:crypto";
import type {
  Category,
  CategorySummary,
  Finding,
  Issue,
  PackSelection,
  PathHotspot,
  RuleDefinition,
  ScanReport,
  ToolStatus,
} from "./types";
import { buildArchitectureSummary } from "./architecture";
import { calculateScore, getIssuePenalty } from "./scoring";

export interface ScanInputMetrics {
  fileCount: number;
  lineCount: number;
  nonEmptyLineCount: number;
}

function toFindingLevel(severity: Issue["severity"]): Finding["level"] {
  if (severity === "CRITICAL" || severity === "HIGH") return "error";
  if (severity === "MEDIUM") return "warning";
  return "note";
}

function fingerprintFor(issue: Issue): string {
  return createHash("sha1")
    .update([issue.id, issue.file, issue.line, issue.message].join("|"))
    .digest("hex");
}

function dedupeIssues(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const fingerprint = fingerprintFor(issue);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

function ruleName(ruleId: string): string {
  return ruleId
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => (part[0] ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function safeDivide(value: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((value / denominator) * 100) / 100;
}

function buildMetricSummary(issues: Issue[], score: number, inputMetrics?: ScanInputMetrics) {
  const fileCount = inputMetrics?.fileCount ?? new Set(issues.map((issue) => issue.file)).size;
  const lineCount = inputMetrics?.lineCount ?? 0;
  const nonEmptyLineCount = inputMetrics?.nonEmptyLineCount ?? 0;
  const kloc = nonEmptyLineCount / 1000;

  return {
    fileCount,
    lineCount,
    nonEmptyLineCount,
    normalized: {
      scorePerFile: safeDivide(score, fileCount),
      scorePerKloc: safeDivide(score, kloc),
      findingsPerFile: safeDivide(issues.length, fileCount),
      findingsPerKloc: safeDivide(issues.length, kloc),
    },
  };
}

function buildPathHotspots(issues: Issue[]): PathHotspot[] {
  const grouped = new Map<string, PathHotspot>();

  for (const issue of issues) {
    const current = grouped.get(issue.file) ?? { path: issue.file, findingCount: 0, penalty: 0 };
    current.findingCount += 1;
    current.penalty += getIssuePenalty(issue);
    grouped.set(issue.file, current);
  }

  return [...grouped.values()]
    .map((hotspot) => ({
      ...hotspot,
      penalty: Math.round(hotspot.penalty * 100) / 100,
    }))
    .sort((left, right) => right.penalty - left.penalty || right.findingCount - left.findingCount || left.path.localeCompare(right.path))
    .slice(0, 5);
}

export function issueToRule(issue: Issue): RuleDefinition {
  return {
    id: issue.id,
    name: ruleName(issue.id),
    category: issue.category,
    defaultSeverity: issue.severity,
    tool: issue.tool,
    shortDescription: ruleName(issue.id),
  };
}

export function issueToFinding(issue: Issue): Finding {
  return {
    id: fingerprintFor(issue),
    rule_id: issue.id,
    level: toFindingLevel(issue.severity),
    severity: issue.severity,
    category: issue.category,
    message: issue.message,
    tool: issue.tool,
    locations: [
      {
        path: issue.file,
        range: {
          start: { line: issue.line, column: 1 },
          end: { line: issue.line, column: 1 },
        },
      },
    ],
    primary_location_index: 0,
    fingerprints: {
      primary: fingerprintFor(issue),
      partial: {
        path_line_rule: `${issue.file}:${issue.line}:${issue.id}`,
        path_rule_message: `${issue.file}:${issue.id}:${issue.message}`,
        path_rule: `${issue.file}:${issue.id}`,
        rule_message: `${issue.id}:${issue.message}`,
      },
    },
    ...(issue.fix
      ? {
          fixes: [
            {
              description: issue.fix,
            },
          ],
        }
      : {}),
    metadata: {
      tier: issue.tier,
    },
  };
}

export function buildScanReport(
  path: string,
  tools: ToolStatus,
  issues: Issue[],
  pack: PackSelection,
  architecture?: string,
  inputMetrics?: ScanInputMetrics,
): ScanReport {
  const normalizedIssues = dedupeIssues(issues);
  const summary = { critical: 0, high: 0, medium: 0, low: 0 };
  const categories: Partial<Record<Category, CategorySummary>> = {};

  for (const issue of normalizedIssues) {
    summary[issue.severity.toLowerCase() as keyof typeof summary]++;
    if (!categories[issue.category]) {
      categories[issue.category] = { count: 0, fixable: 0 };
    }
    categories[issue.category]!.count++;
    if (issue.tier > 0) categories[issue.category]!.fixable++;
  }

  const rules = normalizedIssues.reduce<Record<string, RuleDefinition>>((acc, issue) => {
    if (!acc[issue.id]) acc[issue.id] = issueToRule(issue);
    return acc;
  }, {});
  const findings = normalizedIssues.map(issueToFinding);
  const { score } = calculateScore(normalizedIssues);
  const metrics = buildMetricSummary(normalizedIssues, score, inputMetrics);
  const hotspots = {
    paths: buildPathHotspots(normalizedIssues),
  };

  return {
    schema_version: "desloppify.findings/v1",
    scan: {
      version: "1.0.1",
      path,
      generatedAt: new Date().toISOString(),
      pack,
    },
    architecture: buildArchitectureSummary(architecture, issues),
    tools,
    score,
    metrics,
    hotspots,
    summary,
    categories,
    rules,
    findings,
  };
}
