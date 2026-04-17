import { createHash } from "node:crypto";
import type {
  Category,
  CategorySummary,
  Finding,
  Issue,
  PackSelection,
  RuleDefinition,
  ScanReport,
  ToolStatus,
} from "./types";
import { buildArchitectureSummary } from "./architecture";
import { calculateScore } from "./scoring";

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

function ruleName(ruleId: string): string {
  return ruleId
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => (part[0] ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
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
): ScanReport {
  const summary = { critical: 0, high: 0, medium: 0, low: 0 };
  const categories: Partial<Record<Category, CategorySummary>> = {};

  for (const issue of issues) {
    summary[issue.severity.toLowerCase() as keyof typeof summary]++;
    if (!categories[issue.category]) {
      categories[issue.category] = { count: 0, fixable: 0 };
    }
    categories[issue.category]!.count++;
    if (issue.tier > 0) categories[issue.category]!.fixable++;
  }

  const rules = issues.reduce<Record<string, RuleDefinition>>((acc, issue) => {
    if (!acc[issue.id]) acc[issue.id] = issueToRule(issue);
    return acc;
  }, {});
  const findings = issues.map(issueToFinding);
  const { score } = calculateScore(issues);

  return {
    schema_version: "desloppify.findings/v1",
    scan: {
      version: "0.0.1",
      path,
      generatedAt: new Date().toISOString(),
      pack,
    },
    architecture: buildArchitectureSummary(architecture, issues),
    tools,
    score,
    summary,
    categories,
    rules,
    findings,
  };
}
